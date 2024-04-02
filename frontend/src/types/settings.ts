export type InteractableOptions = {
	type: 'boolean';
};
export interface SettingsPanel {
	name: string;
	description: string;
	id: string;
	sections?: {
		name: string;
		description: string;
		id: string;
		interactables?: {
			label: string;
			description: string;
			id: string;
			options:
				| {type: 'boolean'; state: boolean}
				| {type: 'string'; default: string}
				| {type: 'dropdown'; list: string[]; default: string}
				| {type: 'number'; default: number};
		}[];
	}[];
}
