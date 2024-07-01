// export const createElementx = (selector) => {
// 	var pattern = /^(.*?)(?:#(.*?))?(?:\.(.*?))?(?:@(.*?)(?:=(.*?))?)?$/;
// 	var matches = selector.match(pattern);
// 	var element = document.createElement(matches[1] || 'div');
// 	if (matches[2]) element.id = matches[2];
// 	if (matches[3]) element.className = matches[3];
// 	if (matches[4]) element.setAttribute(matches[4], matches[5] || '');
// 	return element;
// };

export const createElement = (selector) => {
	const names = selector.split(/\.|\#/);
	let element;
	let tagFound = false;
	if (names.length === 0 || names[0] === '') {
		element = document.createElement('div');
	} else {
		element = document.createElement(names[0]);
		tagFound = true;
	}
	const idFinder = selector.split('#');
	let tokens = [];
	if (idFinder.length > 2) return null;
	else if (idFinder.length === 2) {
		element.setAttribute('id', idFinder[1].split('.')[0]);
		tokens = idFinder[1].split('.').splice(0, 1);
	}
	tokens = idFinder[0].split('.').concat(tokens);
	tokens.forEach((t, i) => {
		if (i === 0 && tagFound) return;
		if (t !== '') element.classList.add(t);
	});

	return element;
};
