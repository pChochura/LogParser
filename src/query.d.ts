declare module 'loqs' {
	export const parse: (options: { query: string, }) => {
		matches: (value: string) => boolean,
		columns: (original: [string]) => [string],
	};
};
