exports.gameList = [
	{
		category: 'Board',
		games: [
			{
				displayName: 'PushFight',
				name: 'pushfight',
			},
		],
	},
	// {
	// 	category: 'Card',
	// 	games: [
	// 		{
	// 			displayName: 'Cribbage',
	// 			name: 'cribbage',
	// 		},
	// 		{
	// 			displayName: 'Oh Hell',
	// 			name: 'ohhell',
	// 		},
	// 	],
	// },
	{
		category: 'Other',
		games: [
			{
				displayName: 'Get 10 points',
				name: 'get10',
			},
			{
				displayName: "Liar's Dice",
				name: 'liarsdice',
			},
		],
	},
];

exports.getGame = (gameName) => {
	const game = exports.gameList
		.find((c) => {
			return c.games.some((g) => {
				return g.name.toLowerCase() === gameName.toLowerCase();
			});
		})
		?.games.find((g) => {
			return g.name.toLowerCase() === gameName.toLowerCase();
		});

	return game;
};
