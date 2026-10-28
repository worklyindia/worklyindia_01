-- Team members (invited via Team Management: admin_users rows created by the widget owner)
-- can view the owner's widget and its conversations/messages, and update conversations
-- (e.g. clear unread). Writes to messages stay server-only.

CREATE POLICY "Team can view owner widget"
  ON public.chat_widgets FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.created_by = chat_widgets.user_id
  ));

CREATE POLICY "Team can read conversations"
  ON public.chat_widget_conversations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.created_by = chat_widget_conversations.user_id
  ));

CREATE POLICY "Team can update conversations"
  ON public.chat_widget_conversations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.created_by = chat_widget_conversations.user_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.created_by = chat_widget_conversations.user_id
  ));

CREATE POLICY "Team can read messages"
  ON public.chat_widget_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.created_by = chat_widget_messages.user_id
  ));