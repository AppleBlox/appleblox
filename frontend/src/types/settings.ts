export type InteractableOptions = {
	type: 'boolean';
};

export interface FFlag {
	flag: string;
	enabled: boolean;
	value: string
}

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
				| {type: 'dropdown'; list: {label: string; value: string}[]; default: {label: string; value: string}}
				| {type: 'number'; default: number; max: number; min: number; step: number}
				| {
						type: 'button';
						style: 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' | 'default';
						icon?: string;
				  }
				| {
						type: 'ff_buttons_custom';
				  };
		}[];
	}[];
}
