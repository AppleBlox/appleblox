export interface Contributor {
	name: string;
	description: string;
	avatar: string;
	link: string | null;
	role?: string;
}
export type Technology = Contributor;
