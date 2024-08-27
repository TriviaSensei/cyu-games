import { createElement } from './createElementFromSelector.js';

const createElementHelper = (data) => {
	const toReturn = createElement(data.selector);
	if ((typeof data.contents).toLowerCase() === 'string') {
		toReturn.innerHTML = data.contents;
		return toReturn;
	} else if (Array.isArray(data.contents)) {
		data.contents.forEach((d) => {
			toReturn.appendChild(createElementHelper(d));
		});
		return toReturn;
	} else if ((typeof data.contents).toLowerCase() === 'object') {
		toReturn.appendChild(createElementHelper(data.contents));
		return toReturn;
	}
};

export const handleEndGame = (el, data) => {
	el.innerHTML = '';
	if (Array.isArray(data)) {
		data.forEach((d) => {
			el.appendChild(createElementHelper(d));
		});
	} else if ((typeof data).toLowerCase() === 'object') {
		el.appendChild(createElementHelper(data));
	}
};
