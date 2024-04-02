<script lang="ts">
    import type {SettingsPanel} from '@/types/settings';
    import Panel from './Settings/Panel.svelte';
    
    const panelOpts: SettingsPanel = {
        name: 'FFlags',
        description: 'Configure the integrations between AppleBlox and various apps like Discord with Roblox',
        id: "integrations",
        sections: [
            {
                name: 'Activity Notifications',
                description: "Notifications about the game you're playing & your server location",
                id: "activity",
                interactables: [
                    {
                        label: 'Enable',
                        description: 'Enable this feature',
                        id: "enable",
                        options: {
                            type: "boolean",
                            state: true
                        }
                    },
                    {
                        label: 'text here',
                        description: 'ejejeje',
                        id: "texthing",
                        options: {
                            type: "string",
                            default: "My default text"
                        }
                    },
                    {
                        label: 'A dropdown heehe',
                        description: 'I can use dropdowns',
                        id: "dropdownthing",
                        options: {
                            type: "dropdown",
                            list: ["Banana","Apple","Orange"],
                            default: "Banana",
                        }
                    },
                    
                ],
            },
        ],
    };
    </script>
    
    <Panel panel={panelOpts}/>
    