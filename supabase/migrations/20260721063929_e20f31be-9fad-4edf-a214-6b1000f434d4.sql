
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;

CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.profiles (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  target_exam_id UUID,
  academic_background TEXT,
  target_year TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exams TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read published exams" ON public.exams
  FOR SELECT TO anon, authenticated USING (is_published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage exams" ON public.exams
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.syllabus_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.syllabus_nodes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('subject','chapter','topic','subtopic')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.syllabus_nodes (exam_id, parent_id, sort_order);
GRANT SELECT ON public.syllabus_nodes TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.syllabus_nodes TO authenticated;
GRANT ALL ON public.syllabus_nodes TO service_role;
ALTER TABLE public.syllabus_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read syllabus of published exams" ON public.syllabus_nodes
  FOR SELECT TO anon, authenticated
  USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.exams e WHERE e.id = syllabus_nodes.exam_id AND e.is_published));
CREATE POLICY "Admins manage syllabus nodes" ON public.syllabus_nodes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, avatar_url)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (user_id) DO NOTHING;
  IF lower(NEW.email) = 'anilsanwariya03@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Admins can read syllabus PDFs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'syllabus-pdfs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can upload syllabus PDFs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'syllabus-pdfs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update syllabus PDFs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'syllabus-pdfs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete syllabus PDFs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'syllabus-pdfs' AND public.has_role(auth.uid(), 'admin'));
