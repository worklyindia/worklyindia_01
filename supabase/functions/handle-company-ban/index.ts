import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header with Bearer token
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader) {
      console.error('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'Authorization required. Please refresh and try again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT token and get user - pass the full Authorization header
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    console.log('Auth verification:', { userId: user?.id, hasError: !!authError })
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message)
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed. Please refresh the page and try again.',
          details: authError?.message 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin using admin_users table
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single()
    
    const isAdminData = adminCheck && ['owner', 'admin'].includes(adminCheck.role)
    console.log('Admin check:', { isAdmin: isAdminData, role: adminCheck?.role, error: adminError?.message })
    
    if (adminError) {
      console.error('Admin verification error:', adminError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to verify admin permissions',
          details: adminError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!isAdminData) {
      console.log('Access denied - user is not admin:', user.id)
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { company_id, user_id, action, reason, ban_type } = await req.json()

    if (!company_id || !user_id || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: company_id, user_id, action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'ban') {
      const targetBanType = ban_type || 'profile' // Default to profile ban for backward compatibility
      console.log(`Starting ${targetBanType} ban process for company ${company_id} by admin ${user.id}`)

      if (targetBanType === 'job_posting') {
        // Job Posting Ban: Update employer_settings (primary) and companies table (for consistency)
        
        console.log('🔄 Job posting ban - updating employer_settings for user:', user_id)
        
        // 1. Update employer_settings table (this is what the UI reads from)
        const { data: settingsData, error: settingsError } = await supabaseAdmin
          .from('employer_settings')
          .upsert({ 
            user_id: user_id,
            job_posting_visibility: false,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })
          .select()

        if (settingsError) {
          console.error('❌ Error updating employer settings:', settingsError)
          throw new Error(`Failed to ban job postings in settings: ${settingsError.message}`)
        }
        
        console.log('✅ Employer settings updated successfully:', settingsData)

        // 2. Also update companies table (CRITICAL: Set job_posting_visibility to false)
        const { data: companyData, error: statusError } = await supabaseAdmin
          .from('companies')
          .update({ 
            job_posting_visibility: false, // CRITICAL: This is what the trigger checks
            ban_type: 'job_posting',
            job_posting_ban_reason: reason || 'Job postings banned by admin',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user_id)
          .select()

        if (statusError) {
          console.error('⚠️ Error updating company metadata:', statusError)
          // Don't throw - settings update is more critical
        } else {
          console.log('✅ Company metadata updated successfully:', companyData)
        }

        // 2. Notify employer about job posting ban
        const { error: employerNotifError } = await supabaseAdmin
          .from('employer_notifications')
          .insert({
            user_id,
            title: 'Job Postings Paused',
            message: `Your job posting privileges have been paused.${reason ? ' Reason: ' + reason : ''}`,
            type: 'account',
            action_url: '/employer-portal',
            metadata: { company_id, reason, action: 'job_posting_ban', performed_by: user.id }
          })

        if (employerNotifError) {
          console.error('Error creating employer job posting ban notification:', employerNotifError)
        }

        // 3. Create audit log
        const { error: auditError } = await supabaseAdmin
          .from('admin_audit_logs')
          .insert({
            action: 'job_posting_banned',
            target_id: company_id,
            target_type: 'company',
            details: { reason, user_id, performed_by: user.id, ban_type: 'job_posting' },
            performed_by: user.id,
            performed_at: new Date().toISOString()
          })

        if (auditError) {
          console.error('Error creating audit log:', auditError)
        }

        console.log(`Successfully banned job postings for company ${company_id}`)

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Job postings banned successfully',
            ban_type: 'job_posting',
            affected: {
              job_posting_visibility: 'disabled',
              existing_jobs: 'still_visible'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        // Profile Ban: Full ban with job inactivation
        const { error: statusError } = await supabaseAdmin
          .from('companies')
          .update({ 
            account_status: 'banned',
            ban_type: 'profile',
            account_status_reason: reason || 'Company profile banned by admin',
            profile_ban_reason: reason || 'Company profile banned by admin',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user_id)

        if (statusError) {
          console.error('Error updating company status:', statusError)
          throw new Error(`Failed to ban company: ${statusError.message}`)
        }

        // 2. Notify employer about profile ban
        const { error: employerNotifError } = await supabaseAdmin
          .from('employer_notifications')
          .insert({
            user_id,
            title: 'Account Banned',
            message: `Your company account has been banned.${reason ? ' Reason: ' + reason : ''}`,
            type: 'account',
            action_url: '/employer/disabled',
            metadata: { company_id, reason, action: 'profile_ban', performed_by: user.id }
          })

        if (employerNotifError) {
          console.error('Error creating employer ban notification:', employerNotifError)
          // Continue even if notification fails
        }

        // 3. Remove all notifications from this company to all users
        const { error: notificationError } = await supabaseAdmin
          .from('notifications')
          .delete()
          .filter('metadata->>company_id', 'eq', company_id)

        if (notificationError) {
          console.error('Error removing notifications:', notificationError)
          // Don't throw - continue with other cleanup
        }

        // 4. Get all jobs for this company
        const { data: jobIds, error: jobQueryError } = await supabaseAdmin
          .from('jobs')
          .select('id')
          .eq('company_id', company_id)

        if (jobQueryError) {
          console.error('Error fetching job IDs:', jobQueryError)
        }

        // Only proceed with job-related cleanup if we have job IDs
        if (jobIds && jobIds.length > 0) {
          const jobIdList = jobIds.map(job => job.id)

          // 5. Update job applications to mark them as needing to be hidden from user views
          const { error: applicationError } = await supabaseAdmin
            .from('job_applications')
            .update({ 
              status: 'company_banned'
            })
            .in('job_id', jobIdList)

          if (applicationError) {
            console.error('Error updating job applications status:', applicationError)
            // Don't throw - continue with other cleanup
          }

          // 6. Remove job favorites for this company's jobs
          const { error: favoritesError } = await supabaseAdmin
            .from('job_favorites')
            .delete()
            .in('job_id', jobIdList)

          if (favoritesError) {
            console.error('Error removing job favorites:', favoritesError)
            // Don't throw - continue with other cleanup
          }

          // 7. Mark all jobs from this company as inactive
          const { error: jobError } = await supabaseAdmin
            .from('jobs')
            .update({ 
              status: 'inactive',
              updated_at: new Date().toISOString()
            })
            .eq('company_id', company_id)

          if (jobError) {
            console.error('Error deactivating jobs:', jobError)
            // Don't throw - continue with other cleanup
          }

          console.log(`Processed ${jobIds.length} jobs for company ${company_id}`)
        } else {
          console.log(`No jobs found for company ${company_id}`)
        }

        // 8. Create audit log
        const { error: auditError } = await supabaseAdmin
          .from('admin_audit_logs')
          .insert({
            action: 'company_profile_banned',
            target_id: company_id,
            target_type: 'company',
            details: { reason, user_id, performed_by: user.id, ban_type: 'profile' },
            performed_by: user.id,
            performed_at: new Date().toISOString()
          })

        if (auditError) {
          console.error('Error creating audit log:', auditError)
        }

        console.log(`Successfully banned profile for company ${company_id}`)

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Company profile banned and cleanup completed',
            ban_type: 'profile',
            affected: {
              company_status: 'banned',
              notifications: 'removed',
              job_applications: 'hidden',
              job_favorites: 'removed',
              jobs: 'deactivated'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

    } else if (action === 'unban') {
      const targetBanType = ban_type || 'profile' // Default to profile unban for backward compatibility
      console.log(`Starting ${targetBanType} unban process for company ${company_id} by admin ${user.id}`)

      if (targetBanType === 'job_posting') {
        // Job Posting Unban: Update employer_settings (primary) and companies table (for consistency)
        
        console.log('🔄 Job posting unban - restoring employer_settings for user:', user_id)
        
        // 1. Update employer_settings table (this is what the UI reads from)
        const { data: settingsData, error: settingsError } = await supabaseAdmin
          .from('employer_settings')
          .upsert({ 
            user_id: user_id,
            job_posting_visibility: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })
          .select()

        if (settingsError) {
          console.error('❌ Error updating employer settings:', settingsError)
          throw new Error(`Failed to restore job posting privileges in settings: ${settingsError.message}`)
        }
        
        console.log('✅ Employer settings restored successfully:', settingsData)

        // 2. Also update companies table (CRITICAL: Set job_posting_visibility to true)
        const { data: companyData, error: statusError } = await supabaseAdmin
          .from('companies')
          .update({ 
            job_posting_visibility: true, // CRITICAL: This is what the trigger checks
            ban_type: null,
            job_posting_ban_reason: null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user_id)
          .select()

        if (statusError) {
          console.error('⚠️ Error updating company metadata:', statusError)
          // Don't throw - settings update is more critical
        } else {
          console.log('✅ Company metadata restored successfully:', companyData)
        }

        // 2. Notify employer about job posting restoration
        const { error: employerNotifError } = await supabaseAdmin
          .from('employer_notifications')
          .insert({
            user_id,
            title: 'Job Postings Restored',
            message: 'Your job posting privileges have been restored. You can now post new jobs.',
            type: 'account',
            action_url: '/employer-portal',
            metadata: { company_id, action: 'job_posting_unban', performed_by: user.id }
          })

        if (employerNotifError) {
          console.error('Error creating employer job posting restoration notification:', employerNotifError)
        }

        // 3. Create audit log
        const { error: auditError } = await supabaseAdmin
          .from('admin_audit_logs')
          .insert({
            action: 'job_posting_unbanned',
            target_id: company_id,
            target_type: 'company',
            details: { reason: 'Job posting privileges restored by admin', user_id, performed_by: user.id, ban_type: 'job_posting' },
            performed_by: user.id,
            performed_at: new Date().toISOString()
          })

        if (auditError) {
          console.error('Error creating audit log:', auditError)
        }

        console.log(`Successfully restored job posting privileges for company ${company_id}`)

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Job posting privileges restored successfully',
            ban_type: 'job_posting',
            affected: {
              job_posting_visibility: 'enabled'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        // Profile Unban: Full restoration
        const { error: statusError } = await supabaseAdmin
          .from('companies')
          .update({ 
            account_status: 'active',
            ban_type: null,
            account_status_reason: 'Company unbanned by admin',
            profile_ban_reason: null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user_id)

        if (statusError) {
          console.error('Error updating company status:', statusError)
          throw new Error(`Failed to unban company: ${statusError.message}`)
        }

        // 2. Notify employer about profile restoration
        const { error: employerNotifError } = await supabaseAdmin
          .from('employer_notifications')
          .insert({
            user_id,
            title: 'Account Restored',
            message: 'Your company account has been reactivated. You can resume posting jobs and using employer features.',
            type: 'account',
            action_url: '/employer-portal',
            metadata: { company_id, action: 'profile_unban', performed_by: user.id }
          })

        if (employerNotifError) {
          console.error('Error creating employer unban notification:', employerNotifError)
          // Continue even if notification fails
        }

        // 3. Get all jobs for this company
        const { data: jobIds, error: jobQueryError } = await supabaseAdmin
          .from('jobs')
          .select('id')
          .eq('company_id', company_id)

        if (jobQueryError) {
          console.error('Error fetching job IDs:', jobQueryError)
        }

        // Only proceed with job-related restoration if we have job IDs
        if (jobIds && jobIds.length > 0) {
          const jobIdList = jobIds.map(job => job.id)

          // 4. Restore job applications status 
          const { error: applicationError } = await supabaseAdmin
            .from('job_applications')
            .update({ 
              status: 'applied' // Reset to applied status
            })
            .eq('status', 'company_banned')
            .in('job_id', jobIdList)

          if (applicationError) {
            console.error('Error restoring job applications:', applicationError)
          }

          // 5. Reactivate jobs (optional - might want to keep them inactive)
          const { error: jobError } = await supabaseAdmin
            .from('jobs')
            .update({ 
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('company_id', company_id)
            .eq('status', 'inactive')

          if (jobError) {
            console.error('Error reactivating jobs:', jobError)
            // Don't throw - continue with other operations
          }

          console.log(`Processed ${jobIds.length} jobs for company ${company_id}`)
        } else {
          console.log(`No jobs found for company ${company_id}`)
        }

        // 6. Create audit log
        const { error: auditError } = await supabaseAdmin
          .from('admin_audit_logs')
          .insert({
            action: 'company_profile_unbanned',
            target_id: company_id,
            target_type: 'company',
            details: { reason: 'Profile unbanned by admin', user_id, performed_by: user.id, ban_type: 'profile' },
            performed_at: new Date().toISOString()
          })

        if (auditError) {
          console.error('Error creating audit log:', auditError)
        }

        console.log(`Successfully unbanned profile for company ${company_id}`)

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Company profile unbanned and data restored',
            ban_type: 'profile',
            affected: {
              company_status: 'updated',
              job_applications: 'restored',
              jobs: 'reactivated'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be "ban" or "unban"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in handle-company-ban function:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to handle company ban' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})