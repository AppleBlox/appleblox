export interface SettingsOutput {
	[key: string]: {
		[key: string]: number | string | boolean | [number] | null | { label: string; value: string };
	};
}

/** Element to display inside a select */
export interface SelectElement {
	/** Label that shows as the element */
	label: string;
	/** Value set when choosing the element */
	value: string;
}
