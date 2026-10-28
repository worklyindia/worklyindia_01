INSERT INTO public.email_lifecycle_templates (event_type,subject,body,button_text,button_url,enabled)
SELECT 'payment_' || kind, '{{plan}}',
'<h1>Payment ' || CASE kind WHEN 'success' THEN 'Success' WHEN 'failed' THEN 'Failed' ELSE 'Refund' END || '</h1><p>Hi {{name}},</p><h2>{{plan}}</h2><h3>Payment Details</h3>' ||
'<p>Payment ID: {{payment_id}}</p><p>Method: {{method}}</p><p>Payer UPI ID: {{vpa}}</p><p>Status: ' || CASE kind WHEN 'success' THEN 'Successful' WHEN 'failed' THEN 'Failed' ELSE 'Refunded' END || '</p>' ||
'<p>Amount: {{amount}}</p><p>Received: {{received}}</p><p>RRN: {{rrn}}</p><p>Order ID: {{order_id}}</p><h3>Customer Details</h3><p>Mobile Number: {{mobile}}</p><p>Email ID: {{email}}</p>' ||
CASE kind WHEN 'failed' THEN '<h3>Error Details</h3><p>{{error_description}}</p><p>Error Code: {{error_code}}</p>' WHEN 'refund' THEN '<h3>Refund Updates</h3><p>Refund ID: {{refund_id}}</p><p>Refund Speed: {{refund_speed}}</p><p>Refund Status: {{refund_status}}</p><p>Refunded Amount: {{refund_amount}}</p><p>Refund processed: {{refund_received}}</p>' ELSE '' END ||
'<p style="text-align:center;"><a href="{{pdf_url}}" style="display:inline-block;padding:13px 18px;border-radius:8px;background-color:#188038;color:#ffffff;text-decoration:none;font-weight:700;">Download PDF</a></p>' ||
CASE WHEN kind <> 'failed' THEN '<p style="text-align:center;"><a href="{{invoice_url}}" style="display:inline-block;padding:13px 18px;border-radius:8px;background-color:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;">Download Invoice PDF</a></p>' ELSE '' END,
NULL, '/', true
FROM (VALUES ('success'),('failed'),('refund')) AS kinds(kind)
ON CONFLICT (event_type) DO UPDATE SET subject=EXCLUDED.subject,body=EXCLUDED.body,button_text=NULL,button_url='/',updated_at=now();