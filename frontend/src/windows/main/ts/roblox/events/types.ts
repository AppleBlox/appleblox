export interface RichPresence {
	details?: string;
	state?: string;
	timeStart?: string;
	timeEnd?: string;
	smallImage: RichPresenceImage;
	largeImage: RichPresenceImage;
}

export interface RichPresenceImage {
	assetId?: number;
	hoverText?: string;
	clear?: boolean;
	reset?: boolean;
}

export interface SetWindowData {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	scaleWidth?: number;
	scaleHeight?: number;
	reset?: boolean;
}

export interface ThumbnailResponse {
	targetId: number;
	state: 'Error' | 'Completed' | 'InReview' | 'Pending' | 'Blocked' | 'TemporarilyUnavailable';
	imageUrl: string;
	version: string;
}

export interface ThumbnailApiResponse {
	data: ThumbnailResponse[];
}
