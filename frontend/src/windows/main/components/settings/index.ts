import { type ComponentType, SvelteComponent } from 'svelte';
import { getConfigPath, getValue, loadSettings, saveSettings, setValue } from './files';
import type { SelectElement } from './types';

export { getConfigPath, getValue, loadSettings, saveSettings, setValue };

/** Icon to display inside the button */
export type ButtonIcon =
	| {
			/** The svelte component to display as the button's icon */
			component?: ComponentType<SvelteComponent>;
			/** Tailwind props */
			props?: string;
			/** You cannot use a component and a src */
			src?: never;
	  }
	| {
			/** You cannot use a component and a src */
			component?: never;
			/** Tailwind props */
			props?: string;
			/** URL of the image to use as the button's icon */
			src?: string;
	  };

type WidgetOptions =
	| {
			/** Switch Widget */
			type: 'switch';
			/** Default state (true/false) */
			default: boolean;
	  }
	| {
			/** Empty component */
			type: 'empty';
	  }
	| {
			/** Text input Widget */
			type: 'input';
			/** Greyed text shown when the input is empty */
			placeholder?: string;
			/** Characters that can be typed */
			whitelist?: string;
			/** Characters that can't be typed */
			blacklist?: never;
			/** Default string in the input */
			default: string;
	  }
	| {
			/** Text input Widget */
			type: 'input';
			/** Greyed text shown when the input is empty */
			placeholder?: string;
			/** Characters that can be typed */
			whitelist?: never;
			/** Characters that can't be typed */
			blacklist?: string;
			/** Default string in the input */
			default: string;
	  }
	| {
			/** File picker Widget */
			type: 'filepicker';
			/** Array of extensions (ex: ".jpg") */
			extensions: string[] | undefined;
			/** Default file. Should be a path to a file. */
			default?: string;
	  }
	| {
			/** Select Widget */
			type: 'select';
			/** List of Select elements */
			items: SelectElement[];
			/** Default select element */
			default: string;
	  }
	| {
			/** Slider/Number Widget */
			type: 'slider';
			/** Default value (number) */
			default: number[];
			/** Max value allowed */
			max: number;
			/** Min value needed */
			min: number;
			/** Of how much to increase the slider value at each step */
			step: number;
	  }
	| {
			/** Button Widget */
			type: 'button';
			/** The button variant */
			variant: 'secondary' | 'destructive' | 'outline' | 'ghost' | 'default';
			/** Icon to use for the button, can be an URL or Svelte Component */
			icon?: ButtonIcon;
	  }
	| {
			/** Custom Widget */
			type: 'custom';
			/** Svelte component used to render the widget */
			component: ComponentType<SvelteComponent>;
	  }
	| {
			/** Custom Widget */
			type: 'separator';
			/** Svelte component used to render the widget */
			orientation: 'vertical' | 'horizontal';
			class?: string;
	  };

type ToggleableOption =
	| { id: string; type: 'switch'; value: boolean }
	| { id: string; type: 'slider'; value: [number] }
	| { id: string; type: 'select'; value: string }
	| { id: string; type: 'input'; value: string }
	| { id: string; type: 'filepicker'; value: string }
	| { id: string; type: 'button'; value: never }
	| { id: string; type: 'custom'; value: any };

export interface PanelWidget {
	/** Text to display as title */
	label: string;
	/** Description of the widget */
	description: string;
	/** ID of the widget */
	id: string;
	/** Options (buttons, customs, etc...) */
	options: WidgetOptions;
	/** Toggleable option referencing another widget */
	toggleable?: ToggleableOption;
	/** Add a separator at the top */
	separator?: boolean;
}

export interface Category {
	name: string;
	description: string;
	id: string;
	widgets: PanelWidget[];
	categories: Category[];
	/** Hide the separator line before widgets in this category */
	hideSeparator?: boolean;
}

export interface SettingsPanel {
	name: string;
	description: string;
	id: string;
	categories: Category[];
}

class CategoryBuilder {
	private category: Category;

	constructor(name: string, id: string) {
		this.category = {
			name,
			description: '',
			id,
			widgets: [],
			categories: [],
			hideSeparator: false,
		};
	}

	setName(name: string): this {
		this.category.name = name;
		return this;
	}

	setDescription(description: string): this {
		this.category.description = description;
		return this;
	}

	setId(id: string): this {
		this.category.id = id;
		return this;
	}

	setHideSeparator(hide: boolean): this {
		this.category.hideSeparator = hide;
		return this;
	}

	addCategory(callback: (category: CategoryBuilder) => void): this {
		const newCategoryBuilder = new CategoryBuilder('', '');
		callback(newCategoryBuilder);
		this.category.categories.push(newCategoryBuilder.build());
		return this;
	}

	addSwitch(params: { label: string; description: string; id: string; default: boolean; toggleable?: ToggleableOption }) {
		const widget: PanelWidget = {
			...params,
			options: { type: 'switch', default: params.default },
		};
		this.category.widgets.push(widget);
		return this;
	}

	addEmpty(params: { label: string; description: string; id: string; toggleable?: ToggleableOption }) {
		const widget: PanelWidget = {
			...params,
			options: { type: 'empty' },
		};
		this.category.widgets.push(widget);
		return this;
	}

	addInput(
		params: {
			label: string;
			description: string;
			id: string;
			default: string;
			placeholder?: string;
			toggleable?: ToggleableOption;
		} & ({ whitelist?: string; blacklist?: never } | { whitelist?: never; blacklist?: string })
	) {
		const baseOptions = {
			type: 'input' as const,
			default: params.default,
			placeholder: params.placeholder,
		};

		let widget: PanelWidget;

		if ('whitelist' in params && params.whitelist !== undefined) {
			widget = {
				label: params.label,
				description: params.description,
				id: params.id,
				toggleable: params.toggleable,
				options: { ...baseOptions, whitelist: params.whitelist },
			};
		} else if ('blacklist' in params && params.blacklist !== undefined) {
			widget = {
				label: params.label,
				description: params.description,
				id: params.id,
				toggleable: params.toggleable,
				options: { ...baseOptions, blacklist: params.blacklist },
			};
		} else {
			widget = {
				label: params.label,
				description: params.description,
				id: params.id,
				toggleable: params.toggleable,
				options: baseOptions,
			};
		}

		this.category.widgets.push(widget);
		return this;
	}

	addFilePicker(params: {
		label: string;
		description: string;
		id: string;
		accept?: string[];
		default?: string;
		toggleable?: ToggleableOption;
	}) {
		const widget: PanelWidget = {
			label: params.label,
			description: params.description,
			id: params.id,
			toggleable: params.toggleable,
			options: {
				type: 'filepicker',
				extensions: params.accept,
				default: params.default,
			},
		};
		this.category.widgets.push(widget);
		return this;
	}

	addSelect(params: {
		label: string;
		description: string;
		id: string;
		items: SelectElement[];
		default: string;
		toggleable?: ToggleableOption;
	}) {
		const widget: PanelWidget = {
			label: params.label,
			description: params.description,
			id: params.id,
			toggleable: params.toggleable,
			options: { type: 'select', items: params.items, default: params.default },
		};
		this.category.widgets.push(widget);
		return this;
	}

	addSlider(
		params: {
			label: string;
			description: string;
			id: string;
			toggleable?: ToggleableOption;
		} & Omit<Extract<WidgetOptions, { type: 'slider' }>, 'type'>
	) {
		const widget: PanelWidget = {
			label: params.label,
			description: params.description,
			id: params.id,
			toggleable: params.toggleable,
			options: { type: 'slider', ...params },
		};
		this.category.widgets.push(widget);
		return this;
	}

	addButton(params: {
		label: string;
		description: string;
		id: string;
		variant: Extract<WidgetOptions, { type: 'button' }>['variant'];
		icon?: Extract<WidgetOptions, { type: 'button' }>['icon'];
		toggleable?: ToggleableOption;
	}) {
		const widget: PanelWidget = {
			label: params.label,
			description: params.description,
			id: params.id,
			toggleable: params.toggleable,
			options: { type: 'button', variant: params.variant, icon: params.icon },
		};
		this.category.widgets.push(widget);
		return this;
	}

	addSeparator(params: { orientation: 'vertical' | 'horizontal'; class?: string; toggleable?: ToggleableOption }) {
		const widget: PanelWidget = {
			id: '',
			label: '',
			description: '',
			toggleable: params.toggleable,
			options: { type: 'separator', orientation: params.orientation, class: params.class },
		};
		this.category.widgets.push(widget);
		return this;
	}

	addCustom(params: {
		label: string;
		description: string;
		id: string;
		separator?: boolean;
		component: ComponentType<SvelteComponent>;
		toggleable?: ToggleableOption;
	}) {
		const widget: PanelWidget = {
			label: params.label,
			description: params.description,
			id: params.id,
			toggleable: params.toggleable,
			separator: params.separator,
			options: { type: 'custom', component: params.component },
		};
		this.category.widgets.push(widget);
		return this;
	}

	build(): Category {
		return this.category;
	}
}

export class SettingsPanelBuilder {
	private data: {
		name: string;
		description: string;
		id: string;
		categories: Category[];
	};

	constructor() {
		this.data = { name: '', id: '', description: '', categories: [] };
	}

	setName(name: string): this {
		this.data.name = name;
		return this;
	}

	setDescription(description: string): this {
		this.data.description = description;
		return this;
	}

	setId(id: string): this {
		this.data.id = id;
		return this;
	}

	addCategory(callback: (category: CategoryBuilder) => void): this {
		const categoryBuilder = new CategoryBuilder('', '');
		callback(categoryBuilder);
		this.data.categories.push(categoryBuilder.build());
		return this;
	}

	build(): SettingsPanel {
		return this.data;
	}
}
