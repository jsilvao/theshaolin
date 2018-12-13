$.when(
	$.getScript('https://apis.google.com/js/client.js?onload=handleClientLoad'),
	$.getScript('https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js'),
	$.getScript('https://cdn.jsdelivr.net/gh/jshaolin/theshaolin@1.2/mexitel.ajax.js'),
	$.getScript('https://cdn.jsdelivr.net/gh/jshaolin/theshaolin@1.2/pdf.js'),
	$.getScript('https://cdn.jsdelivr.net/gh/jshaolin/theshaolin@1.2/cbl.js'),
	$.Deferred(function(deferred) {
		$(deferred.resolve);
	})
).done(initialize);

var captchaReady = false;

var authorizeBtn = "<li><a href='#' id='authorize-button' class='hidden'></a></li>";
var pdfDialog = "<div id='floating-pdf' class='ui-helper-hidden'><object id='data-pdf' type='application/pdf' width='100%' height='99%'><embed type='application/pdf' /></object></div>";
var emailDialog = "<div id='floating-email' class='ui-helper-hidden'></div>";
var controlsDialog = "<div id='floating-controls' class='ui-helper-hidden' title='Controls' style='padding:10px;'><div style='display:table; width:100%; height:100%; border-spacing:10px;'></div></div>"

var tokenQuery = 'from:citas_sre@sre.gob.mx,subject:Token,is:unread';

var clientId = '963048267522-sb3a16350r0u747hkrsvrlqvjq1vdqt7.apps.googleusercontent.com';
var apiKey = 'AIzaSyD6qhxXVsysg6nyhDt5DRUafmNYcLHInRI';
var scopes = 'https://mail.google.com/';

var cbl = undefined;
var mxAjax = undefined;

var captchaId = 'captcha-img';
var timeout = 1000;

function initialize() {
	PDFJS.workerSrc = 'https://cdn.jsdelivr.net/gh/jshaolin/theshaolin@1.2/pdf.worker.js';
	cbl = new CBL({
		preprocess: function(img) {
			img.opaque();
			img.binarize(100);
			img.colorRegions(50, true);
		},
		blob_min_pixels: 50,
		blob_max_pixels: 1000,
		pattern_width: 50,
		pattern_height: 50,
		pattern_maintain_ratio: true
	});

	keepAlive();
}

function insertJuegala() {
	if (!$('#juegala').length) {
		var btnHtml = '<span id="juegala" class="ui-button ui-corner-all secundario" onclick="captchaReady = true" style="width:100%; margin-bottom:20px;">Juegala!</span>';
		$('#formRegistroCitaExtranjero\\:panelDatosUsuario > tbody').append('<tr><td>'+ btnHtml +'</td></tr>');
	}
}

function ajaxPlay() {
	mxAjax.play();
	$("#floating-controls").dialog({ title: "Running" });
}

function ajaxPause() {
	mxAjax.pause();
	$("#floating-controls").dialog({ title: "Paused" });
}

function insertControls() {
	$('body').append(controlsDialog);

	var play = '<span class="ui-button ui-corner-all secundario" onclick="ajaxPlay()" style="width:calc(50% - 10px); height:100%; float:none !important; display:table-cell; line-height:100%;"><i class="fa fa-play" aria-hidden="true"></i></span>';
	var pause = '<span class="ui-button ui-corner-all" onclick="ajaxPause()" style="width:calc(50% - 10px); height:100%; float:none !important; display:table-cell; line-height:100%;" disabled><i class="fa fa-pause" aria-hidden="true"></i></span>';
	
	$('#floating-controls div').append(play);
	$('#floating-controls div').append(pause);
}

function keepAlive() {
	setInterval(function() {
		ajaxAlive();
		PF('statusDialog').hide();
	}, 2 * 60 * 1000);
}

function handleClientLoad() {
	$('#headerForm\\:pnlMexitel div ul').append(authorizeBtn);
	$('body').append(pdfDialog);
	$('body').append(emailDialog);
	insertControls();

	gapi.load('client:auth2', initClient);
}

function initClient() {
	gapi.client.init({
		apiKey: apiKey,
		clientId: clientId,
		discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"],
		scope: scopes
	}).then(function () {
	  	gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
	  	updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
	});
}

function updateSigninStatus(isSignedIn) {
	if (isSignedIn) {
		$('#authorize-button').on('click', handleSignoutClick);
		$('#authorize-button').text('Sign out');

		if (isSignedIn) {
			var profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
			console.log('Full Name: ' + profile.getName());
			console.log('Email: ' + profile.getEmail());
		}		
	} else {
		$('#authorize-button').on('click', handleAuthClick);
		$('#authorize-button').text('Authorize');
	}

	$('#authorize-button').removeClass("hidden");
}

function handleAuthClick(event) {
	gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick(event) {
	gapi.auth2.getAuthInstance().signOut();
}

async function fetchEmails() {
	return new Promise(resolve => {
		var request = gapi.client.gmail.users.messages.list({
			'userId': 'me',
			'label': 'Inbox',
			'q': tokenQuery
		});

		request.execute(resolve);
	});
}

async function fetchEmail(message) {
	return new Promise(resolve => {
		var request = gapi.client.gmail.users.messages.get({
			'userId': 'me',
			'id': message.id
		});

		request.execute(resolve);
	});
}

async function getAttachment(message) {
	return new Promise(resolve => {
		var parts = message.payload.parts;
		for (var i = 0; i < parts.length; i++) {
			var part = parts[i];
			if (part.filename && part.filename.length > 0) {
				var attachId = part.body.attachmentId;
				var request = gapi.client.gmail.users.messages.attachments.get({
					'userId': 'me',
					'id': attachId,
					'messageId': message.id
				});

				request.execute(resolve);
				break;
			}
		}
	});
}

async function markAsRead(message) {
	return new Promise(resolve => {
		var request = gapi.client.gmail.users.messages.modify({
			'userId': 'me',
			'id': message.id,
			'removeLabelIds': ['UNREAD']
		});

		request.execute(resolve);
	});
}

function getBody(message) {
	var encodedBody = '';
	if(typeof message.parts === 'undefined')
		encodedBody = message.body.data;
	else
		encodedBody = getHTMLPart(message.parts);
	
	encodedBody = encodedBody.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
	return decodeURIComponent(escape(window.atob(encodedBody)));
}

function getHTMLPart(arr) {
	for(var x = 0; x <= arr.length; x++)
		if(typeof arr[x].parts === 'undefined')
		{
			if(arr[x].mimeType === 'text/html')
			return arr[x].body.data;
		}
		else
			return getHTMLPart(arr[x].parts);

	return '';
}

async function getToken(pdf) {
	var pageNumbers = [];
	for (var i = 1; i <= pdf.numPages; i++)
		pageNumbers.push(i);

	var pages = await Promise.all(pageNumbers.map(p => pdf.getPage(p)));
	var contents = await Promise.all(pages.map(p => p.getTextContent()));

	var token = '';

	for (var content of contents)
	for (var item of content.items)
	for (var word of item.str.split(' '))
		if (word.length > token.length)
			token = word;

	return token;
}

async function getCaptcha(pdf) {
	var pageNumbers = [];
	for (var i = 1; i <= pdf.numPages; i++)
		pageNumbers.push(i);

	var pages = await Promise.all(pageNumbers.map(p => pdf.getPage(p)));
	var ops = await Promise.all(pages.map(p => p.getOperatorList()));

	var imgPage = undefined;
	var imgArgs = [undefined, 10000, 10000];

	var dimensions = [756+320, 600+230, 821+410, 396+121];
	for (var p = 0; p < pdf.numPages; p++)
		for (var i = 0; i < ops[p].fnArray.length; i++)
			if (ops[p].fnArray[i] == PDFJS.OPS.paintImageXObject) {
				var args = ops[p].argsArray[i];
				for (var dim of dimensions)
					if (Math.abs(args[1] + args[2] - dim) < 20)
						continue;

				if (args[1] + args[2] < imgArgs[1] + imgArgs[2]) {
					imgPage = pages[p];
					imgArgs = args;
				}
			}

	if (imgArgs[0]) {
		var imgData = imgPage.objs.get(imgArgs[0]);
		return PDFJS.convertImgDataToPng(imgData);
	}

	return undefined;
}

function displayEmail() {
	$('#floating-email').dialog({
		position: { my: 'left', at: 'left', of: window },
		width: 600,
		height: 500
	});

	$('.ui-dialog').css('z-index', 9999);
}

function displayPdf() {
	$('#floating-pdf').dialog({
		position: { my: 'right', at: 'right', of: window },
		width: 600,
		height: 800
	});

	$('.ui-dialog').css('z-index', 9999);
}

function displayControls() {
	$('#floating-controls').dialog({
		position: { my: 'center', at: 'center', of: window },
		width: 200,
		height: 150
	});

	$('.ui-dialog').css('z-index', 9999);
}

async function breakCaptcha(imgId) {
	return new Promise(resolve => cbl.solve(imgId).done(resolve));
}

function base64toBlob(content, contentType) {
	contentType = contentType || '';
	var sliceSize = 512;
	content = content.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
	var byteCharacters = window.atob(content);

	var byteArrays = [];

	for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
		var slice = byteCharacters.slice(offset, offset + sliceSize);
		var byteNumbers = new Array(slice.length);
		for (var i = 0; i < slice.length; i++) 
			byteNumbers[i] = slice.charCodeAt(i);

		var byteArray = new Uint8Array(byteNumbers);
		byteArrays.push(byteArray);
	}

	var blob = new Blob(byteArrays, {type: contentType}); 
	return blob;
}

async function notify() {
	var context = new AudioContext();
	var o = context.createOscillator();
	o.type = "sine";
	o.connect(context.destination);
	o.start();
	o.stop(context.currentTime + 1);

	return Promise.resolve(true);
}

async function captchaGoogle() {
	while (!($("[name=g-recaptcha-response]").val()))
		await delay(timeout);

	await delay(50);
	return true;
}

async function captchaCode() {
	insertJuegala();

	while (!captchaReady)
		await delay(timeout);

	await delay(50);
	return true;
}

async function appoinment() {
	$('[name=formRegistroCitaExtranjero\\:buscarCita]').click();
	return waitProcessing();
}

async function dates() {
	return calendar('div.fc-month-view', '[name=formRegistroCitaExtranjero\\:Month]');
}

async function weeks() {
	return calendar('div.fc-agendaWeek-view', '[name=formRegistroCitaExtranjero\\:Week]');
}

async function times() {
	//return calendar('div.fc-agendaDay-view', '[name=formRegistroCitaExtranjero\\:Day]');
	return calendar('div.fc-agendaDay-view', '[name=formRegistroCitaExtranjero\\:Month]');
}

async function tokenFor(name) {
	while (true) {
		var pdfUrl = await fetchPdf(name);			

		if (pdfUrl) {			
			var pdf = await PDFJS.getDocument({url: pdfUrl});

			var tkn = await getToken(pdf);
			$('[name=reviewForm\\:confirmToken]').val(tkn);

			var captchaUrl = await getCaptcha(pdf);
			insertHelpers(captchaUrl);				

			return true;
		}

		await delay(1000);
	}
}

async function captcha() {
	var solution = await breakCaptcha(captchaId);
	if (solution) {
		$('[name=reviewForm\\:confirmCodigoSeguridad]').val(solution);
		return true;
	}

	return false;
}

async function accept() {
	$('[name=reviewForm\\:confirmarCita]').click();
	return waitProcessing();
}

function insertHelpers(imgUrl) {
	var table = '<table><tbody><tr>' + 
				'<td><label class="control-label">Captcha:</label></td>' + 
				'<td><img id="reviewForm:j_idt402" width="5px" alt="" src="/citas.webportal/javax.faces.resource/spacer/dot_clear.gif.jsf?ln=primefaces&amp;v=5.2"></td>' +
				'<td><img id="' + captchaId + '" src="' + imgUrl + '" style="height: 57px;"></td>' +
				'<td><span class="ui-button ui-corner-all secundario" onclick="displayEmail()" style="margin-left: 5px; margin-right: 5px; padding: 5px !important;">EMAIL</span></td>' + 
				'<td><span class="ui-button ui-corner-all secundario" onclick="displayPdf()">PDF</span></td>' + 
				'</tr></tbody></table>';

	$(table).insertBefore('#reviewForm\\:panelCodigoSeguridad');
}

async function waitProcessing() {
	while ($('span:contains("Procesando")').is(':visible'))
		await delay(timeout);

	await delay(50);
	return true;
}

function tokenCode() {
	var firstName = $('#reviewForm\\:confirnombre').text().trim();
	var lastName = $('#reviewForm\\:confirApellidoPat').text().trim();

	var fullName = [firstName, lastName].join(' ');
	tokenFor(fullName)
		.then(captcha)
		.then();
}

async function fetchPdf(name) {
	var response = await fetchEmails();
	var messages = response.messages || [];
	var promises = messages.map(x => fetchEmail(x));
	var emails = await Promise.all(promises);

	for (var mail of emails) {
		var data = await checkEmailForPdf(mail, name);
		if (data) {
			var blob = base64toBlob(data, 'application/pdf');
			var url = URL.createObjectURL(blob);
			$('#data-pdf').attr('data', url);

			return url;
		}
	}
}

async function checkEmailForPdf(message, name) {
	var body = getBody(message.payload);

	var regex = new RegExp(name, 'i');
	if (regex.test(body))
	{
		await markAsRead(message);
		$('#floating-email').html(body);

		var attachment = await getAttachment(message);
		return attachment.data;
	}

	return null;
}

async function calendar(type, reset) {
	while (true) {
		if ($(type).length) {
			var calendar = $('a.rangoTotalDisponibilidad');
			if (calendar.length) {
				var index = random(calendar.length);
				calendar[index].click();
				return waitProcessing();
			}
			calendar = $('a.rangoAltaDisponibilidad');
			if (calendar.length) {
				var index = random(calendar.length);
				calendar[index].click();
				return waitProcessing();
			}
			calendar = $('a.rangoModerado');
			if (calendar.length) {
				var index = random(calendar.length);
				calendar[index].click();
				return waitProcessing();
			}
			calendar = $('a.rangoSaturado');
			if (calendar.length) {
				$('button.fc-next-button').click();
				await waitProcessing();
				continue;
			}
		}

		var btn = $(reset);
		if (btn.length) {
			btn.click()
			await waitProcessing();
		} else {
			return false;
		}
	}
}

async function select(select, option) {
	select = $(select);
	option = select.find('option:contains("'+option+'")');

	let force = select.is(':enabled');
	if (option.length) {
		if (force || select.val() != option.val())
			select.val(option.val()).change();
		return waitProcessing();
	}

	return Promise.resolve(false);
}

function set(select, option) {
	select = $(select);
	option = select.find('option:contains("'+option+'")');
	if (option.length) {
		if (select.val() != option.val())
			select.val(option.val());
	}
}

async function delay(milliseconds) {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function random(max) {
	return Math.floor(Math.random() * max);
}

var MX = function(person, options = null) {
	var userDefaults = {
		passportCountry: 'CUBA',
		nationality: 'CUBA',
		birthCountry: 'CUBA'
	}

	var defaults = {
		clear: 'ESTADOS UNIDOS',
		country: 'CUBA',
		documentType: 'VISAS',
		procedure: 'SIN PERMISO',
		procedureType: 'TURISMO',
		setDateAndTime: true,
		findCaptchaAndToken: true,
		acceptAppointment: true,
		useAjax: false,
		first: false,
		last: false,
		ImNotARobot: true,
		displayControls: false
	};

	options = options || {};
	for (var opt in defaults) {
		if (defaults.hasOwnProperty(opt) && !options.hasOwnProperty(opt)) {
			options[opt] = defaults[opt];
		}
	}

	for (var opt in userDefaults) {
		if (userDefaults.hasOwnProperty(opt) && !person.hasOwnProperty(opt)) {
			person[opt] = userDefaults[opt];
		}
	}

	var tasks = [];
	var isPaused = false;

	var obj = {
		start: function() {
			stop();
			tasks = getTasks();
			process().then(function() {
				console.log('Done!');
			})
		},
		pause: function() {
			isPaused = true;
		},
		continue: function() {
			isPaused = false;
		},
		stop: function() {
			tasks = [];
			isPaused = false;
		}
	};

	async function process() {
		var index = 0;
		var captchaIndex = tasks.findIndex(t => t.name.includes("CAPTCHA"));

		while (index < tasks.length) {
			if (isPaused) {
				await delay(timeout);
				continue;
			}

			var task = tasks[index];

			console.log(task.name);
			var isSuccess = await task.action();

			if (isSuccess)
				index++;
			else if (index > captchaIndex) {
				captchaReady = false;
				index = captchaIndex - 1;
			}
			else
				index = Math.max(0, index - 1);
		}
	}

	function getTasks() {
		var tasks = [];

		if (options.useAjax)
			tasks.push({ action: ajaxCode, name: "Using AJAX" });
		else {
			tasks.push({ action: clear, name: "Clearing" });
			tasks.push({ action: country, name: "Setting " + options.country });
			tasks.push({ action: documents, name: "Setting " + options.documentType });
			tasks.push({ action: procedure, name: "Setting " + options.procedure });
			//tasks.push({ action: detail, name: "Setting " + options.procedureType });
			tasks.push({ action: userInfo, name: "Setting USER" });
			tasks.push({ action: notify, name: "Notify!!!" });

			if (options.ImNotARobot)
				tasks.push({ action: captchaGoogle, name: "Checking CAPTCHA" });
			else
				tasks.push({ action: captchaCode, name: "Checking CAPTCHA" });

			tasks.push({ action: appoinment, name: "Searching APPOINTMENTS" });
			if (options.setDateAndTime) {
				tasks.push({ action: dates, name: "Setting DATE" });
				tasks.push({ action: times, name: "Setting TIME" });
				//tasks.push({ action: weeks, name: "Setting WEEK" });
				if (options.findCaptchaAndToken) {
					tasks.push({ action: token, name: "Fetching TOKEN and CAPTCHA" });
					tasks.push({ action: captcha, name: "Breaking CAPTCHA" });
					if (options.acceptAppointment) {
						tasks.push({ action: accept, name: "Accepting APPOINTMENT" });
					}
				}
			}
		}

		return tasks;
	}

	async function clear() {
		return select('[name=formRegistroCitaExtranjero\\:selectPais_input]', options.clear);
	}
	
	async function country() {
		return select('[name=formRegistroCitaExtranjero\\:selectPais_input]', options.country);
	}
	
	async function documents() {
		return select('[name=formRegistroCitaExtranjero\\:selectTipoDocumento_input]', options.documentType);
	}
	
	async function procedure() {
		return select('[name=formRegistroCitaExtranjero\\:selectTramite_input]', options.procedure);
	}
	
	async function detail() {
		return select('[name=formRegistroCitaExtranjero\\:selectTipoTramite_input]', options.procedureType);
	}
	
	async function userInfo() {
		set('[name=formRegistroCitaExtranjero\\:selectPaisPasaporte_input]', person.passportCountry);
		set('[name=formRegistroCitaExtranjero\\:selectNacionalidad_input]', person.nationality);
		set('[name=formRegistroCitaExtranjero\\:selectPaisNacimiento_input]', person.birthCountry);
		set('[name=formRegistroCitaExtranjero\\:selectTipoTramite_input]', options.procedureType);
	
		$('[name=formRegistroCitaExtranjero\\:noPasapAnt]').val(person.passport);
		$('[name=formRegistroCitaExtranjero\\:nombre]').val(person.firstName.toUpperCase());
		$('[name=formRegistroCitaExtranjero\\:Apellidos]').val(person.lastName.toUpperCase());
		$('[name=formRegistroCitaExtranjero\\:fechaNacimiento_input]').val(person.birthdate);
		$('[name=formRegistroCitaExtranjero\\:sexo_input]').val(person.sex);
		return Promise.resolve(true);
	}

	async function token() {
		var fullName = getFullName();
		return await tokenFor(fullName);
	}

	async function ajaxCode() {
		if (options.displayControls)
			displayControls();

		options.tokenCode = ajaxTokenCode;

		mxAjax = MX_AJAX(person, options);
		await mxAjax.process();
		return true;
	}

	async function ajaxTokenCode() {
		var fullName = getFullName();

		while (true) {
			var pdfUrl = await fetchPdf(fullName);
	
			if (pdfUrl) {
				displayPdf();
				displayEmail();

				var pdf = await PDFJS.getDocument({url: pdfUrl});
				var captchaUrl = await getCaptcha(pdf);
				
				var captcha = await breakCaptcha(captchaUrl);
				var token = await getToken(pdf);
	
				console.log("CAPTCHA: " + captcha);
				console.log("TOKEN: " + token);
				return {token: token, captcha: captcha};
			}
	
			await delay(timeout);
		}
	}

	function getFullName() {
		return [person.firstName, person.lastName].join(' ');
	}

	return obj;
}