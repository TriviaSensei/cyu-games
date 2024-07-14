const { v4: uuidV4 } = require('uuid');

const verifyGameData = (data, user) => {
	let message = '';

	if (data.game === 'pushfight') {
		if (!['black', 'white', 'random'].includes(data.color))
			message = 'Invalid color specified';
		else if (!['game', 'move', 'off'].includes(data.timer))
			message = 'Invalid timer setting';
		else if (data.timer === 'game') {
			if (data.time < 5) message = 'Invalid game length - minimum is 5 minutes';
			else if (data.increment < 0)
				message = 'Invalid increment length - must not be negative';
		} else if (data.timer === 'move') {
			if (data.time < 1)
				message = 'Invalid move timer length - minimum is 1 minute';
			else if (data.reserve < 0)
				message = 'Invalid reserve length - must not be negative';
		}
		if (!message) {
			const timerState = {
				time: data.timer === 'off' ? null : data.time * 60 * 1000,
				increment: data.timer === 'game' ? data.increment * 1000 : 0,
				reserve: data.timer === 'move' ? data.reserve * 60 * 1000 : 0,
			};
			const boardState = [];
			for (var space = 0; space < 32; space++) {
				const newSpace = {
					piece: null,
					space,
					valid: true,
					up: space - 4 >= 0 ? space - 4 : -1,
					down: space + 4 <= 31 ? space + 4 : -1,
					left: space % 4 === 0 ? null : space - 1,
					right: space % 4 === 3 ? null : space + 1,
				};
				//handle cut out spaces - these can be pushed into, but not moved into
				//left edges
				if ([1, 25, 29].includes(space)) newSpace.left = -1;
				//right edges
				if ([2, 6, 30].includes(space)) newSpace.right = -1;
				//top edges
				if ([4, 11].includes(space)) newSpace.up = -1;
				//bottom edges
				if ([20, 27].includes(space)) newSpace.down = -1;
				//cut out spaces
				if ([0, 3, 7, 24, 28, 31].includes(space)) newSpace.valid = false;

				boardState.push(newSpace);
			}
			data.gameState = {
				active: false,
				timer: data.timer,
				players: [
					{
						...timerState,
						id: data.color === 'white' ? user.id : null,
						name: data.color === 'white' ? user.name : null,
						rating: data.color === 'white' ? user.rating : null,
					},
					{
						...timerState,
						id: data.color === 'black' ? user.id : null,
						name: data.color === 'black' ? user.name : null,
						rating: data.color === 'black' ? user.rating : null,
					},
				],
				turnsCompleted: 0,
				moveList: [],
				boardState,
			};
		}
	} else message = 'Invalid game name';

	if (message !== '') return { status: 'fail', message };
	return {
		...data,
		matchId: uuidV4(),
		status: 'OK',
	};
};

module.exports = verifyGameData;
