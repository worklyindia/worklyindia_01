-- Create blog_posts table for real blog data
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  content text,
  category text,
  author text,
  image_url text,
  read_time text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.blog_posts enable row level security;

-- Drop policies if they exist
drop policy if exists "Admins can manage blog posts" on public.blog_posts;
drop policy if exists "Public can read published posts" on public.blog_posts;

-- Admins can manage posts
create policy "Admins can manage blog posts"
  on public.blog_posts
  for all
  using (exists (select 1 from admin_users au where au.user_id = auth.uid() and au.role = any(array['admin','owner'])))
  with check (exists (select 1 from admin_users au where au.user_id = auth.uid() and au.role = any(array['admin','owner'])));

-- Public can read published posts
create policy "Public can read published posts"
  on public.blog_posts
  for select
  using (is_published = true);

-- Updated at trigger
create or replace function public.update_blog_posts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists set_blog_posts_updated_at on public.blog_posts;
create trigger set_blog_posts_updated_at
before update on public.blog_posts
for each row execute function public.update_blog_posts_updated_at();

-- Seed initial posts (only if not already inserted)
insert into public.blog_posts (slug, title, excerpt, content, category, author, image_url, read_time, is_published, published_at)
select * from (values
  ('remote-jobs-india-2024', 'Top 10 Remote Job Opportunities in India for 2024', 'Discover the most in-demand remote jobs in India and how to land them in 2024.', '<p>India''s remote job market is booming across tech, customer success, content, and design. This guide highlights growing roles, required skills, and where to find legitimate opportunities.</p>', 'Career Advice', 'Workly India Editorial', '/images/blog/remote-jobs-2024.jpg', '5 min read', true, now() - interval '280 days'),
  ('work-from-home-success-tips', '10 Essential Tips for Workly India Success', 'Master the art of working remotely with these proven strategies for productivity and work-life balance.', '<p>Improve your Workly India productivity with a structured routine, proper workspace, goal setting, time blocking, and communication best practices.</p>', 'Productivity', 'Workly India Editorial', '/images/blog/wfh-success-tips.jpg', '7 min read', true, now() - interval '277 days'),
  ('digital-marketing-remote-jobs', 'Breaking into Digital Marketing: Remote Job Guide', 'Everything you need to know about starting a career in digital marketing from home.', '<p>Digital marketing offers multiple remote-friendly roles like SEO, social media, content, and performance marketing. Learn the roadmap and skills.</p>', 'Career Growth', 'Workly India Editorial', '/images/blog/digital-marketing-remote.jpg', '6 min read', true, now() - interval '275 days'),
  ('interview-preparation-remote-jobs', 'Ace Your Remote Job Interview: Complete Guide', 'Comprehensive tips and strategies to excel in virtual interviews and land your dream remote job.', '<p>From camera setup to behavioral questions, this guide helps you shine in virtual interviews and avoid common mistakes.</p>', 'Interview Tips', 'Workly India Editorial', '/images/blog/remote-interview-guide.jpg', '8 min read', true, now() - interval '273 days')
) as v(slug,title,excerpt,content,category,author,image_url,read_time,is_published,published_at)
where not exists (select 1 from public.blog_posts p where p.slug = v.slug);