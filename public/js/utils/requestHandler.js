const srvr = location.origin;

export const handleRequest = (
	requestStr,
	requestType,
	requestBody,
	responseHandler,
	...external
) => {
	const str =
		external.length > 0 && external[0] ? requestStr : `${srvr}${requestStr}`;
	const req = new XMLHttpRequest();
	if (req.readyState === 0 || req.readyState === 4) {
		req.open(requestType.toUpperCase(), str, true);
		req.onreadystatechange = () => {
			if (req.readyState == 4) {
				if (req.status !== 204) {
					const res = JSON.parse(req.response);
					responseHandler(res);
				} else {
					responseHandler({
						status: 'success',
					});
				}
			}
		};
		req.setRequestHeader('Content-type', 'application/json; charset=utf-8');
		try {
			if (requestBody) {
				req.send(JSON.stringify(requestBody));
			} else {
				req.send(null);
			}
		} catch (err) {}
	}
};

export const handleMultiRequest = (
	requestStr,
	requestType,
	formData,
	responseHandler,
	...external
) => {
	const str =
		external.length > 0 && external[0] ? requestStr : `${srvr}${requestStr}`;
	const req = new XMLHttpRequest();
	if (req.readyState === 0 || req.readyState === 4) {
		req.open(requestType.toUpperCase(), str);
		req.onreadystatechange = () => {
			if (req.readyState == 4) {
				const res = JSON.parse(req.response);
				responseHandler(res);
			}
		};
		req.send(formData);
	}
};
