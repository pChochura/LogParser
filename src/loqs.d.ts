declare module 'loqs' {
	export const parse: (
		args: { directory: string, extension: string; },
		query: {
			matches: (value: string) => boolean,
			columns: (original: [string]) => [string],
		}
	) => void;
};
