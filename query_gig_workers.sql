-- Query to show all gig workers with Name, Phone Number, Mail ID, and Coverage Pincodes
SELECT 
    CONCAT(p.first_name, ' ', p.last_name) AS "Name",
    p.phone AS "Phone Number",
    p.email AS "Mail ID",
    COALESCE(
        array_to_string(gp.coverage_pincodes, ', '), 
        'No coverage pincodes'
    ) AS "Coverage Pincodes"
FROM 
    public.gig_partners gp
    INNER JOIN public.profiles p ON gp.profile_id = p.id
WHERE 
    p.role = 'gig_worker'
ORDER BY 
    p.first_name, p.last_name;


