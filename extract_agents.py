
import yaml
import json
import os

def extract_agent_data():
    config_path = r'd:\work\веб\2\TimeTalk\EpochalDialog\backend\config\agents.yaml'
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    agents = config.get('agents', [])
    
    agent_translations = {}
    all_categories = set()
    
    for agent in agents:
        name = agent.get('name')
        description = agent.get('description', '')
        categories_str = agent.get('category', '')
        categories = categories_str.split(',')
        
        agent_translations[name] = {
            "name": name,
            "description": description
        }
        
        for cat in categories:
            cat = cat.strip()
            if cat:
                all_categories.add(cat)
                
    return agent_translations, sorted(list(all_categories))

if __name__ == "__main__":
    translations, categories = extract_agent_data()
    with open('extracted_agents.json', 'w', encoding='utf-8') as f:
        json.dump({"agents": translations, "categories": categories}, f, ensure_ascii=False, indent=2)
    print("Data saved to extracted_agents.json")
