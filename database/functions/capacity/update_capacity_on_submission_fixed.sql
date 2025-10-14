-- =====================================================
-- Update Capacity on Case Submission - Fixed
-- Background Verification Platform
-- =====================================================

-- Function to update capacity when a case is submitted
CREATE OR REPLACE FUNCTION update_capacity_on_submission()
RETURNS TRIGGER AS $$
DECLARE
    gig_worker_id UUID;
    vendor_id UUID;
    current_date_val DATE;
BEGIN
    -- Only process when status changes to 'submitted'
    IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
        
        -- Get the assignee information
        gig_worker_id := NEW.current_assignee_id;
        vendor_id := NEW.current_vendor_id;
        current_date_val := CURRENT_DATE;
        
        -- Update gig worker capacity if assigned to a gig worker
        IF gig_worker_id IS NOT NULL AND NEW.current_assignee_type = 'gig' THEN
            -- Update gig_partners table
            UPDATE gig_partners 
            SET 
                capacity_available = GREATEST(0, capacity_available - 1),
                active_cases_count = GREATEST(0, active_cases_count - 1),
                total_cases_completed = total_cases_completed + 1,
                last_assignment_at = now()
            WHERE id = gig_worker_id;
            
            -- Update capacity_tracking table
            INSERT INTO capacity_tracking (
                gig_partner_id,
                date,
                max_daily_capacity,
                initial_capacity_available,
                current_capacity_available,
                cases_allocated,
                cases_accepted,
                cases_in_progress,
                cases_submitted,
                cases_completed,
                last_capacity_freed_at,
                last_reset_at,
                reset_count,
                is_active
            )
            SELECT 
                gig_worker_id,
                current_date_val,
                gp.max_daily_capacity,
                gp.max_daily_capacity,
                GREATEST(0, gp.capacity_available - 1),
                0, -- cases_allocated
                0, -- cases_accepted
                0, -- cases_in_progress
                1, -- cases_submitted
                1, -- cases_completed
                now(),
                now(),
                0,
                true
            FROM gig_partners gp
            WHERE gp.id = gig_worker_id
            ON CONFLICT (gig_partner_id, date) DO UPDATE SET
                current_capacity_available = GREATEST(0, capacity_tracking.current_capacity_available - 1),
                cases_submitted = capacity_tracking.cases_submitted + 1,
                cases_completed = capacity_tracking.cases_completed + 1,
                last_capacity_freed_at = now(),
                updated_at = now();
        END IF;
        
        -- Update vendor capacity if assigned to a vendor
        IF vendor_id IS NOT NULL THEN
            -- Update vendors table
            UPDATE vendors 
            SET 
                capacity_available = GREATEST(0, capacity_available - 1),
                active_cases_count = GREATEST(0, active_cases_count - 1),
                total_cases_assigned = total_cases_assigned + 1
            WHERE id = vendor_id;
        END IF;
        
        -- Log the capacity update
        INSERT INTO audit_logs (
            entity_type,
            entity_id,
            action,
            new_values,
            case_id,
            user_id,
            metadata
        ) VALUES (
            'case',
            NEW.id,
            'capacity_updated_on_submission',
            jsonb_build_object(
                'gig_worker_id', gig_worker_id,
                'vendor_id', vendor_id,
                'previous_status', OLD.status,
                'new_status', NEW.status,
                'capacity_freed', 1
            ),
            NEW.id,
            NEW.last_updated_by,
            jsonb_build_object(
                'trigger', 'update_capacity_on_submission',
                'timestamp', now()
            )
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_update_capacity_on_submission ON cases;
CREATE TRIGGER trigger_update_capacity_on_submission
    AFTER UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION update_capacity_on_submission();

-- Also create a function to manually update capacity for existing submitted cases
CREATE OR REPLACE FUNCTION fix_capacity_for_submitted_cases()
RETURNS JSONB AS $$
DECLARE
    updated_gig_workers INTEGER := 0;
    updated_vendors INTEGER := 0;
    gig_worker_record RECORD;
    vendor_record RECORD;
BEGIN
    -- Update gig workers based on their submitted cases
    FOR gig_worker_record IN
        SELECT 
            gp.id,
            gp.capacity_available,
            gp.active_cases_count,
            gp.total_cases_completed,
            COUNT(c.id) as submitted_cases
        FROM gig_partners gp
        LEFT JOIN cases c ON gp.id = c.current_assignee_id 
            AND c.current_assignee_type = 'gig' 
            AND c.status = 'submitted'
        GROUP BY gp.id, gp.capacity_available, gp.active_cases_count, gp.total_cases_completed
        HAVING COUNT(c.id) > 0
    LOOP
        UPDATE gig_partners 
        SET 
            capacity_available = GREATEST(0, gig_worker_record.capacity_available - gig_worker_record.submitted_cases),
            active_cases_count = GREATEST(0, gig_worker_record.active_cases_count - gig_worker_record.submitted_cases),
            total_cases_completed = gig_worker_record.total_cases_completed + gig_worker_record.submitted_cases
        WHERE id = gig_worker_record.id;
        
        updated_gig_workers := updated_gig_workers + 1;
    END LOOP;
    
    -- Update vendors based on their submitted cases
    FOR vendor_record IN
        SELECT 
            v.id,
            v.capacity_available,
            v.active_cases_count,
            v.total_cases_assigned,
            COUNT(c.id) as submitted_cases
        FROM vendors v
        LEFT JOIN cases c ON v.id = c.current_vendor_id 
            AND c.status = 'submitted'
        GROUP BY v.id, v.capacity_available, v.active_cases_count, v.total_cases_assigned
        HAVING COUNT(c.id) > 0
    LOOP
        UPDATE vendors 
        SET 
            capacity_available = GREATEST(0, vendor_record.capacity_available - vendor_record.submitted_cases),
            active_cases_count = GREATEST(0, vendor_record.active_cases_count - vendor_record.submitted_cases),
            total_cases_assigned = vendor_record.total_cases_assigned + vendor_record.submitted_cases
        WHERE id = vendor_record.id;
        
        updated_vendors := updated_vendors + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Capacity updated for submitted cases',
        'updated_gig_workers', updated_gig_workers,
        'updated_vendors', updated_vendors
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION fix_capacity_for_submitted_cases() TO authenticated;

-- Test the function
SELECT fix_capacity_for_submitted_cases();
