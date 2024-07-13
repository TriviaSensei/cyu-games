export const getElementArray = (item, selector) => {
	if (!item) return [];
	return Array.from(item.querySelectorAll(selector), (x) => x);
};
