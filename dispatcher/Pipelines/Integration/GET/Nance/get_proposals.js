// Extract project data for the current governance cycle from Nance

async function getProposals(space, cycle) {
    let url = `https://api.nance.app/${space}/proposals`;
    if (typeof cycle === 'number') {
        url += `?cycle=${cycle}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to retrieve proposals: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        try {
            console.log("Full API Response:", JSON.stringify(result, null, 2));
        } catch (stringifyError) {
            console.error("Error stringifying API response:", stringifyError);
            console.log("Raw API Response:", result);
        }

        if (result.success && result.data.proposals.length > 0) {
            return result.data.proposals; 
            console.log("No proposals found.");
            return null;
        }
    } catch (error) {
        console.error("Error fetching proposals:", error);
        return null;
    }
}

// Export the function
module.exports = {
    getProposals
};

// Move the IIFE to only run if this file is called directly
if (require.main === module) {
    (async () => {
        const space = process.argv[2] || "moondao";
        let cycle = process.argv[3] || "current";
    
        console.log("Space:", space);
        console.log("Cycle (before conversion):", cycle);
    
        if (!isNaN(cycle)) {
            cycle = Number(cycle);
        }
    
        console.log("Cycle (after conversion):", cycle);
    
        const proposals = await getProposals(space, cycle);
        if (!proposals) {
            return "No proposals found.";
        }
        return proposals;
    })();
}