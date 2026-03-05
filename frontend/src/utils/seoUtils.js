/**
 * Utility functions for SEO and Structured Data (JSON-LD)
 */

/**
 * Generates JSON-LD schema for a person (historical figure/AI agent)
 * @param {Object} agent - The agent data
 * @param {string} baseUrl - Base URL of the site
 * @returns {Object|null} JSON-LD schema object or null
 */
export const getPersonSchema = (agent, baseUrl = 'https://epochaldialog.com') => {
    if (!agent) return null;

    const schema = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": agent.name || agent.agent_name,
        "description": agent.description || agent.agent_description || "",
        "image": agent.image_url || agent.avatar_url || "",
        "url": `${baseUrl}/chat/${agent.id}`,
    };

    // Add more specific fields if available
    if (agent.category) {
        schema.jobTitle = agent.category;
    }

    // If it's a known historical figure, we could add sameAs links
    // This is a simple heuristic based on name
    const sameAsMap = {
        "сократ": "https://ru.wikipedia.org/wiki/Сократ",
        "socrates": "https://en.wikipedia.org/wiki/Socrates",
        "платон": "https://ru.wikipedia.org/wiki/Платон",
        "plato": "https://en.wikipedia.org/wiki/Plato",
        "ницше": "https://ru.wikipedia.org/wiki/Фридрих_Ницше",
        "nietzsche": "https://en.wikipedia.org/wiki/Friedrich_Nietzsche",
        "марк аврелий": "https://ru.wikipedia.org/wiki/Марк_Аврелий",
        "marcus aurelius": "https://en.wikipedia.org/wiki/Marcus_Aurelius",
        "наполеон": "https://ru.wikipedia.org/wiki/Наполеон_I",
        "napoleon": "https://en.wikipedia.org/wiki/Napoleon",
    };

    const name = (agent.name || agent.agent_name || "").toLowerCase();
    for (const [key, url] of Object.entries(sameAsMap)) {
        if (name.includes(key)) {
            schema.sameAs = [url];
            break;
        }
    }

    return schema;
};

/**
 * Generates JSON-LD schema for a collection of items (library of agents)
 * @param {Array} agents - List of agents
 * @param {string} baseUrl - Base URL of the site
 * @returns {Object} JSON-LD schema object
 */
export const getCollectionSchema = (agents, baseUrl = 'https://epochaldialog.com') => {
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": (agents || []).slice(0, 10).map((agent, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "item": {
                "@type": "Person",
                "name": agent.name,
                "description": agent.description || "",
                "image": agent.image_url || agent.avatar_url || "",
                "url": `${baseUrl}/chat/${agent.id}`
            }
        }))
    };
};
