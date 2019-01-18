$.when(
	$.getScript('https://apis.google.com/js/client.js?onload=handleClientLoad'),
	$.getScript('https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js'),
	$.getScript('https://cdn.jsdelivr.net/gh/jshaolin/theshaolin@1.2/pdf.js'),
	$.getScript('https://cdn.jsdelivr.net/gh/jshaolin/theshaolin@1.2/cbl.js'),
	$.Deferred(function(deferred) {
		$(deferred.resolve);
	})
).done(initialize);

var authorizeBtn = "<li><a href='#' id='authorize-button' class='hidden'></a></li>";
var pdfDialog = "<div id='floating-pdf' class='ui-helper-hidden'><object id='data-pdf' type='application/pdf' width='100%' height='99%'><embed type='application/pdf' /></object></div>";
var emailDialog = "<div id='floating-email' class='ui-helper-hidden'></div>";

var cbl = undefined;

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

	gapi.load('client:auth2', initClient);
}

function initClient() {
	gapi.client.init({
		apiKey: 'AIzaSyD6qhxXVsysg6nyhDt5DRUafmNYcLHInRI',
		clientId: '963048267522-sb3a16350r0u747hkrsvrlqvjq1vdqt7.apps.googleusercontent.com',
		discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"],
		scope: 'https://mail.google.com/'
	}).then(function () {
	  	gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
	  	updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
	});
}

function updateSigninStatus(isSignedIn) {
	if (isSignedIn) {
		$('#authorize-button').on('click', handleSignoutClick);
		$('#authorize-button').text('Sign out');

		var profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
		console.log('Full Name: ' + profile.getName());
		console.log('Email: ' + profile.getEmail());
		
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


var errorX = null;

var MX_AJAX = function(person) {
    
    async function waitProcessing() {
        while ($('span:contains("Procesando")').is(':visible'))
            await delay(500);
    }
    async function delay(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }
    function random(max) {
        return Math.floor(Math.random() * max);
    }
    function viewState() {
        return $('[name=javax\\.faces\\.ViewState]').val()
    }
    function captchaValue() {
        return $('[name=g-recaptcha-response]').val();
    }
    function getFullName() {
		return [person.firstName, person.lastName].join(' ');
    }
    async function fetchEmails() {
        return new Promise(resolve => {
            var request = gapi.client.gmail.users.messages.list({
                'userId': 'me',
                'label': 'Inbox',
                'q': 'from:citas_sre@sre.gob.mx,subject:Token,is:unread'
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
	
			await delay(500);
		}
	}

    async function setCountry() {
        while (true) {
            
            console.log('Setting Country.');

            $('[name=formRegistroCitaExtranjero\\:selectPais_input]').val(17).change();
            await waitProcessing();

            if ($('[name=formRegistroCitaExtranjero\\:selectTipoDocumento_input] option').length > 1)
                break;

            $('[name=formRegistroCitaExtranjero\\:selectPais_input]').val(24).change();
            await waitProcessing();

            await delay(500);
        }
    }
    
    async function setCaptcha() {
        console.log('Checking Captcha.');

        while (!captchaValue())
        {
            await delay(500);
        }
    }

    async function request(payload) {
        payload['javax.faces.ViewState'] = viewState();
        payload['g-recaptcha-response'] = captchaValue();

        var settings = {
            async: true,
            crossDomain: true,
            url: "https://mexitel.sre.gob.mx/citas.webportal/pages/private/cita/registro/registroCitasPortalExtranjeros.jsf",
            method: "POST",
            data: payload,
            xhrFields: { withCredentials: true },
            timeout: 30000
        };

        try { return await $.when($.ajax(settings)); }
        catch (error) {
            errorX = error;
            return null; 
        }
    }

    async function setDocument() {
        var payload = Object.assign({}, payloads.document);

        while (true) {
            
            console.log('Setting Document.');

            var html = await request(payload);
            if (html) {
                var form = $(html).find('#formRegistroCitaExtranjero');
                if (form.length) {
                    html = form.html();

                    var regexPro = new RegExp('SIN PERMISO', 'i');
                    if (regexPro.test(html)) break;
                }            
            }

            await delay(500);
        }
    }

    async function setProcedure() {
        var payload = Object.assign({}, payloads.procedure);

        payload['formRegistroCitaExtranjero:selectTramite_input'] = "12";

        while (true) {
            
            console.log('Setting Procedure.');

            var html = await request(payload);
            if (html) {
                var form = $(html).find('#formRegistroCitaExtranjero');
                if (form.length) {
                    html = form.html();

                    var regexPro = new RegExp('SIN PERMISO', 'i');
                    if (regexPro.test(html)) break;
                }            
            }

            await delay(500);
        }
    }

    async function setUserInfo(person) {
        var payload = Object.assign({}, payloads.userInfo);

        payload['formRegistroCitaExtranjero:noPasapAnt'] = person.passport;
        payload['formRegistroCitaExtranjero:selectTramite_input'] = "12";
        payload = Object.assign(payload, payloads.userInfoSinPermiso);
        payload['formRegistroCitaExtranjero:nombre'] = person.firstName;
        payload['formRegistroCitaExtranjero:Apellidos'] = person.lastName;
        payload['formRegistroCitaExtranjero:fechaNacimiento_input'] = person.birthdate;
        payload['formRegistroCitaExtranjero:sexo_input'] = person.sex;
        payload['formRegistroCitaExtranjero:selectTipoTramite_input'] = "63";

        while (true) {
            
            console.log('Setting User Info.');

            var html = await request(payload);
            if (html) {
                var form = $(html).find('#formRegistroCitaExtranjero');
                if (form.length) {
                    html = form.html();

                    var regex = new RegExp('formRegistroCitaExtranjero:schedule', 'i');
                    if (regex.test(html)) break
                }

                var captchaRegex = /captcha\s*no\s*coincide/i;
                if (captchaRegex.test(html)) {
                    grecaptcha.reset()

                    await delay(500);
                    await setCaptcha();
                }
            }

            await delay(500);
        }
    }

    async function setCalendarWeek(person) {
        var payload = Object.assign({}, payloads.agendaWeek);

        payload['formRegistroCitaExtranjero:noPasapAnt'] = person.passport;
        payload['formRegistroCitaExtranjero:selectTramite_input'] = "12";
        payload = Object.assign(payload, payloads.agendaWeekSinPermiso);
        payload['formRegistroCitaExtranjero:selectTipoTramite_input'] = "63";

        while (true) {
            
            console.log('Setting Week Calendar.');

            var html = await request(payload);
            if (html) {
                var form = $(html).find('#formRegistroCitaExtranjero\\:schedule');
                if (form.length) {
                    html = form.html();

                    var regex = new RegExp('value="agendaWeek"', 'i');
                    if (regex.test(html)) break;
                }
            }

            await delay(500);
        }
    }

    async function fetchSchedule(person) {
        var payload = Object.assign({}, payloads.schedule);

        payload['formRegistroCitaExtranjero:noPasapAnt'] = person.passport;
        payload['formRegistroCitaExtranjero:selectTramite_input'] = "12";
        payload['formRegistroCitaExtranjero:schedule_start'] = new Date(2018, 7, 20, 0, 0, 0, 0).getTime().toString();
        payload['formRegistroCitaExtranjero:schedule_end'] = new Date(2019, 2, 15, 0, 0, 0, 0).getTime().toString();
        payload = Object.assign(payload, payloads.agendaWeekSinPermiso);
        payload['formRegistroCitaExtranjero:selectTipoTramite_input'] = "63";

        while (true) {
            
            console.log('Fetching Calendar Data.');

            var html = await request(payload);
            if (html) {
                var form = $(html).find('#formRegistroCitaExtranjero\\:schedule');
                if (form.length) {
                    html = form.html().replace(/\s/g, '');

                    var expr = /{"events":\[\S*?\]}/i;
                    var match = expr.exec(html);
            
                    if (match) {
                        var result = JSON.parse(match[0]);
                        
                        var availables = 0;
                        result.events.forEach(o => availables += parseInt(o.title));
                        console.log(availables + ' remaining');

                        if (result.events.length > 0)
                            return result.events;
                    }
                }
            }

            await delay(500);
            await setCalendarWeek(person);

            await delay(500);
        }
    }

    async function requestAppointment(person, event) {
        var payload = Object.assign({}, payloads.appointment);

        payload["formRegistroCitaExtranjero:noPasapAnt"] = person.passport;
        payload["formRegistroCitaExtranjero:schedule_selectedEventId"] = event;
        payload['formRegistroCitaExtranjero:selectTramite_input'] = "12";
        payload = Object.assign(payload, payloads.appointmentSinPermiso);
        payload['formRegistroCitaExtranjero:selectTipoTramite_input'] = "63";

        

        while (true) {
            
            console.log('Requesting Appointment.');

            var html = await request(payload);
            if (html) {
                var form = $(html).find('#reviewForm');
                if (form.length) break;
            }

            await delay(500);
        }
    }

    async function acceptAppointment(token, captcha) {
        var payload = Object.assign({}, payloads.accept);

        payload["reviewForm:confirmToken"] = token;
        payload["reviewForm:confirmCodigoSeguridad"] = captcha;

        while (true) {
            
            console.log('Accepting Appointment.');

            var html = await request(payload);
            if (html) {
                var form = $(html).find('#citaForm');			
                if (form.length) {
                    html = form.html();
            
                    var expr = /Folio de la cita : [^<]+/i;
                    var match = expr.exec(html);
                    if (match) { 
                        console.log(match[0]);
                        return true;
                    }
                }
                
                return false;
            }

            await delay(500);
        }
    }

    return { 
        start: async function() {
            //stop();
            await setCountry();
            await delay(250);

            await setDocument();
            await delay(250);

            await setProcedure();
            await delay(250);
            
            document.title = "CAPTCHA";
            await setCaptcha();
            await delay(500);

            await setUserInfo(person);
            await delay(250);

            while (true) {
                await setCalendarWeek(person);
                await delay(500);

                var events = await fetchSchedule(person);
                await delay(500);

                var index = random(events.length);
                var event = events[index];
    
                await requestAppointment(person, event.id);
                var tc = await ajaxTokenCode();
                await delay(500);
                
                if (await acceptAppointment(tc.token, tc.captcha)) break;
                await delay(500);
            }
        },
        stop: function() {
            console.log('STOPPED');
        }
    };
};

const payloads = {
    document: {
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "formRegistroCitaExtranjero:selectTipoDocumento",
        "javax.faces.partial.execute": "formRegistroCitaExtranjero:selectTipoDocumento",
        "javax.faces.partial.render": "formRegistroCitaExtranjero:panelDatosSedes formRegistroCitaExtranjero:message formRegistroCitaExtranjero:layoutRegistroCitas matriculaConsularDialog formRegistroCitaExtranjero:panelSelectNoLegalizados formRegistroCitaExtranjero:panelnoPasapNUT formRegistroCitaExtranjero:panelnoPasapAnt formRegistroCitaExtranjero:panelBotonesNut formRegistroCitaExtranjero:panelApellidos formRegistroCitaExtranjero:panelApellidoPat formRegistroCitaExtranjero:panelApellidoMat formRegistroCitaExtranjero formRegistroCitaExtranjero:panelSelectPaisNacimiento formRegistroCitaExtranjero:panelNacionalidad formRegistroCitaExtranjero:panelSelectPaisPasaporte",
        "javax.faces.behavior.event": "change",
        "javax.faces.partial.event": "change",
        "formRegistroCitaExtranjero": "formRegistroCitaExtranjero",
        "formRegistroCitaExtranjero:selectPais_focus": "",
        "formRegistroCitaExtranjero:selectPais_input": "17",
        "formRegistroCitaExtranjero:selectSedeUbicacion_filter": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_focus": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_input": "4",
        "formRegistroCitaExtranjero:selectTramite_focus": "",
        "formRegistroCitaExtranjero:selectTramite_input": "",
        "formRegistroCitaExtranjero:selectTipoTramite_focus": "",
        "formRegistroCitaExtranjero:selectTipoTramite_input": "",
        "formRegistroCitaExtranjero:nombre": "",
        "formRegistroCitaExtranjero:ApellidoPat": "",
        "formRegistroCitaExtranjero:ApellidoMat": "",
        "formRegistroCitaExtranjero:fechaNacimiento_input": "",
        "formRegistroCitaExtranjero:sexo_focus": "",
        "formRegistroCitaExtranjero:sexo_input": "",
        "formRegistroCitaExtranjero:teldomicilio": "",
        "formRegistroCitaExtranjero:telmovil": "",
        "javax.faces.ViewState": ""
    },
    procedure: {
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "formRegistroCitaExtranjero:selectTramite",
        "primefaces.resetvalues": "true",
        "javax.faces.partial.execute": "formRegistroCitaExtranjero:selectTramite",
        "javax.faces.partial.render": "formRegistroCitaExtranjero:panelDatosSedes formRegistroCitaExtranjero:panelSelectNoLegalizados formRegistroCitaExtranjero:panelnoPasapNUT formRegistroCitaExtranjero:panelnoPasapAnt formRegistroCitaExtranjero:panelBotonesNut formRegistroCitaExtranjero formRegistroCitaExtranjero:panelSelectPaisNacimiento formRegistroCitaExtranjero:panelNacionalidad formRegistroCitaExtranjero:panelSelectPaisPasaporte",
        "javax.faces.behavior.event": "change",
        "javax.faces.partial.event": "change",
        "formRegistroCitaExtranjero:selectTramite_focus": "",
        "formRegistroCitaExtranjero:selectTramite_input": "",
        "javax.faces.ViewState": ""
    },
    userInfo: {
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "formRegistroCitaExtranjero:buscarCita",
        "javax.faces.partial.execute": "formRegistroCitaExtranjero formRegistroCitaExtranjero:buscarCita formRegistroCitaExtranjero:layoutCalendarWeb",
        "javax.faces.partial.render": "formRegistroCitaExtranjero formRegistroCitaExtranjero:layoutCalendarWeb formRegistroCitaExtranjero:captcha",
        "formRegistroCitaExtranjero:buscarCita": "formRegistroCitaExtranjero:buscarCita",
        "formRegistroCitaExtranjero": "formRegistroCitaExtranjero",
        "formRegistroCitaExtranjero:selectPais_focus": "",
        "formRegistroCitaExtranjero:selectPais_input": "17",
        "formRegistroCitaExtranjero:selectSedeUbicacion_filter": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_focus": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_input": "4",
        "formRegistroCitaExtranjero:selectTramite_focus": "",
        "formRegistroCitaExtranjero:selectTramite_input": "",
        "formRegistroCitaExtranjero:noPasapAnt": "",
        "formRegistroCitaExtranjero:teldomicilio": "",
        "formRegistroCitaExtranjero:telmovil": "",
        "javax.faces.ViewState": ""
    },
    userInfoSinPermiso: {
        "formRegistroCitaExtranjero:selectTipoTramite_focus": "",
        "formRegistroCitaExtranjero:selectTipoTramite_input": "",
        "formRegistroCitaExtranjero:selectPaisPasaporte_focus": "",
        "formRegistroCitaExtranjero:selectPaisPasaporte_input": "17",
        "formRegistroCitaExtranjero:nombre": "",
        "formRegistroCitaExtranjero:Apellidos": "",
        "formRegistroCitaExtranjero:selectNacionalidad_focus": "",
        "formRegistroCitaExtranjero:selectNacionalidad_input": "49",
        "formRegistroCitaExtranjero:fechaNacimiento_input": "",
        "formRegistroCitaExtranjero:selectPaisNacimiento_focus": "",
        "formRegistroCitaExtranjero:selectPaisNacimiento_input": "17",
        "formRegistroCitaExtranjero:sexo_focus": "",
        "formRegistroCitaExtranjero:sexo_input": "",
    },
    agendaWeek: {
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "formRegistroCitaExtranjero:Week",
        "javax.faces.partial.execute": "formRegistroCitaExtranjero:Week",
        "javax.faces.partial.render": "formRegistroCitaExtranjero:schedule",
        "formRegistroCitaExtranjero:Week": "formRegistroCitaExtranjero:Week",
        "formRegistroCitaExtranjero": "formRegistroCitaExtranjero",
        "formRegistroCitaExtranjero:selectPais_focus": "",
        "formRegistroCitaExtranjero:selectPais_input": "17",
        "formRegistroCitaExtranjero:selectSedeUbicacion_filter": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_focus": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_input": "4",
        "formRegistroCitaExtranjero:selectTramite_focus": "",
        "formRegistroCitaExtranjero:selectTramite_input": "",
        "formRegistroCitaExtranjero:noPasapAnt": "",
        "formRegistroCitaExtranjero:teldomicilio": "",
        "formRegistroCitaExtranjero:telmovil": "",
        "formRegistroCitaExtranjero:schedule_view": "agendaWeek",
        "javax.faces.ViewState": ""
    },
    agendaWeekSinPermiso: {
        "formRegistroCitaExtranjero:selectTipoTramite_focus": "",
        "formRegistroCitaExtranjero:selectTipoTramite_input": "",
        "formRegistroCitaExtranjero:selectPaisPasaporte_filter": "",
        "formRegistroCitaExtranjero:selectNacionalidad_filter": "",
        "formRegistroCitaExtranjero:selectPaisNacimiento_filter": ""
    },
    schedule: {
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "formRegistroCitaExtranjero:schedule",
        "javax.faces.partial.execute": "formRegistroCitaExtranjero:schedule",
        "javax.faces.partial.render": "formRegistroCitaExtranjero:schedule",
        "formRegistroCitaExtranjero:schedule": "formRegistroCitaExtranjero:schedule",
        "formRegistroCitaExtranjero:schedule_start": "",
        "formRegistroCitaExtranjero:schedule_end": "",
        "formRegistroCitaExtranjero": "formRegistroCitaExtranjero",
        "formRegistroCitaExtranjero:selectPais_focus": "",
        "formRegistroCitaExtranjero:selectPais_input": "17",
        "formRegistroCitaExtranjero:selectSedeUbicacion_filter": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_focus": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_input": "4",
        "formRegistroCitaExtranjero:selectTramite_focus": "",
        "formRegistroCitaExtranjero:selectTramite_input": "",
        "formRegistroCitaExtranjero:noPasapAnt": "",
        "formRegistroCitaExtranjero:teldomicilio": "", 
        "formRegistroCitaExtranjero:telmovil": "",
        "formRegistroCitaExtranjero:schedule_view": "agendaWeek",
        "javax.faces.ViewState": ""
    },
    scheduleSinPermiso: {
        "formRegistroCitaExtranjero:selectTipoTramite_focus": "", 
        "formRegistroCitaExtranjero:selectTipoTramite_input": "",
        "formRegistroCitaExtranjero:selectPaisPasaporte_filter": "",
        "formRegistroCitaExtranjero:selectNacionalidad_filter": "",
        "formRegistroCitaExtranjero:selectPaisNacimiento_filter": "",
    },
    appointment: {
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "formRegistroCitaExtranjero:schedule",
        "javax.faces.partial.execute": "formRegistroCitaExtranjero:schedule",
        "javax.faces.partial.render": "formRegistroCitaExtranjero reviewForm",
        "javax.faces.behavior.event": "eventSelect",
        "javax.faces.partial.event": "eventSelect",
        "formRegistroCitaExtranjero:schedule_selectedEventId": "",
        "formRegistroCitaExtranjero": "formRegistroCitaExtranjero",
        "formRegistroCitaExtranjero:selectPais_focus": "",
        "formRegistroCitaExtranjero:selectPais_input": "17",
        "formRegistroCitaExtranjero:selectSedeUbicacion_filter": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_focus": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_input": "4",
        "formRegistroCitaExtranjero:selectTramite_focus": "",
        "formRegistroCitaExtranjero:selectTramite_input": "",
        "formRegistroCitaExtranjero:noPasapAnt": "",
        "formRegistroCitaExtranjero:teldomicilio": "",
        "formRegistroCitaExtranjero:telmovil": "",
        "formRegistroCitaExtranjero:schedule_view": "agendaWeek",
        "javax.faces.ViewState": ""
    },
    appointmentSinPermiso: {
        "formRegistroCitaExtranjero:selectTipoTramite_focus": "",
        "formRegistroCitaExtranjero:selectTipoTramite_input": "",
        "formRegistroCitaExtranjero:selectPaisPasaporte_filter": "",
        "formRegistroCitaExtranjero:selectNacionalidad_filter": "",
        "formRegistroCitaExtranjero:selectPaisNacimiento_filter": "",
    },
    accept: {
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "reviewForm:confirmarCita",
        "javax.faces.partial.execute": "@all",
        "javax.faces.partial.render": "formRegistroCitaExtranjero citaForm reviewForm",
        "reviewForm:confirmarCita": "reviewForm:confirmarCita",
        "reviewForm": "reviewForm",
        "reviewForm:confirmCodigoSeguridad": "",
        "reviewForm:confirmToken": "",
        "javax.faces.ViewState": ""
    }
};