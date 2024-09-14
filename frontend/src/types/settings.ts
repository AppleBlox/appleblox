import { type ComponentType, SvelteComponent } from 'svelte';

export type InteractableOptions = {
	type: 'boolean';
};

export interface FFlag {
	flag: string;
	enabled: boolean;
	value: string;
}

export interface Icon {
	component?: ComponentType<SvelteComponent>;
	props?: string;
	src?: string;
}

interface DropdownElement {
	label: string;
	value: string;
}

export interface SettingsPanel {
	name: string;
	description: string;
	id: string;
	sections: {
		name: string;
		description: string;
		id: string;
		interactables: {
			label: string;
			description: string;
			id: string;
			/** Hide the title (only see the description) */
			hideTitle?: boolean;
			/** Grays out the interactable if set to false */
			toggle?: string;
			options:
				| {
						type: 'boolean';
						state: boolean;
						/** Forces the value to the one set here **/
						value?: boolean;
				  }
				| { type: 'none' }
				| {
						type: 'string';
						default: string;
						/** Forces the value to the one set here **/
						value?: string;
				  }
				| {
						type: 'file';
						accept: string[];
						default?: string;
						/** Forces the value to the one set here **/
						value?: string;
				  }
				| {
						type: 'dropdown';
						list: DropdownElement[];
						default: DropdownElement;
						/** Forces the value to the one set here **/
						value?: DropdownElement;
				  }
				| {
						type: 'number';
						default: number;
						max: number;
						min: number;
						step: number;
						/** Forces the value to the one set here **/
						value?: number;
				  }
				| {
						type: 'button';
						style:
							| 'secondary'
							| 'destructive'
							| 'outline'
							| 'ghost'
							| 'link'
							| 'default';
						icon?: Icon;
				  }
				| {
						type: 'ff_buttons_custom';
				  }
				| {
						type: 'mods_ui';
				  };
		}[];
	}[];
}
