# Move owner media, chat media and job images to Cloudflare (original quality)

## Goal
Images, videos and PDFs for the areas below are stored in Cloudflare instead of the current storage, kept in their original quality (no WebP conversion, no shrinking), and deleted from Cloudflare when the item using them is removed or replaced.

## Areas covered
1. **Owner pages**: Email Templates, WhatsApp Templates, Telegram Templates, Brand & Logo (logo, dark logo, favicon, social preview image).
   - Existing crop tools stay exactly as they are; the cropped result is uploaded as-is (PNG/JPG kept).
   - Replacing or removing an image deletes the old Cloudflare file.
2. **Chats**: Email chat, WhatsApp chat, Instagram and Facebook chat attachments (images, video, PDF, files).
   - Sent/received media saved to Cloudflare in original form.
   - Deleting a message or a whole chat deletes its Cloudflare files.
3. **Job postings** (Post Job, Post New Job, Edit Job):
   - Remove the "Generate image with AI" option.
   - Job image upload goes to Cloudflare in original HD.
   - Changing the image or deleting the job deletes the Cloudflare file.

## What stays the same
- Old images already saved keep working (no forced re-upload); they are shown as before.
- Login images, home banners and the Storage Manager already use Cloudflare and are untouched.
- Data, sign-in and functions remain on the current backend project.

## Technical details
- Reuse the existing `egress-optimizer` function and its R2 helpers (`r2Storage.ts`, `bannerImage.ts` pattern): add generic actions `r2-upload-media` (folder whitelist: `brand/`, `templates/email|whatsapp|telegram/`, `chat/<channel>/<owner>/`, `jobs/`) and `r2-delete-media`, owner/user-authorized server-side. No new edge function (function cap).
- Large files (video/PDF) use the existing presigned browser-direct upload flow (`r2-sa-upload-init`) so size limits don't apply.
- New client helper `src/lib/r2Media.ts` (upload/delete/extractKey), replacing `brandAssetStorage.ts` upload target and the uploads in template editors, chat attachment menus, `JobImageUploader.tsx`.
- Bypass `compressImageFile` and wsrv.nl WebP proxy for R2 URLs (`storageImageUrl`, `imageEgressGuard` already pass non-Supabase URLs through; confirm).
- Server-side chat media from webhooks (`meta-whatsapp-webhook`, `_shared/mailAttachments.ts`, Instagram/Facebook handlers) store to R2 instead of Supabase Storage.
- Deletion: on job delete/edit, template save/delete, brand asset replace, and chat/message delete, call `r2-delete-media` for removed URLs; add R2 URL columns to the orphan sweep so leftovers get cleaned.
- Remove `AIImageGenerator.tsx` usage from the three job pages.
- Deno-check edited edge modules; deploy `egress-optimizer` and webhook functions via the GitHub Actions workflow.
- Tests: key extraction/folder whitelist, and "delete job removes its R2 key".
