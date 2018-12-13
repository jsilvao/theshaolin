var errorX = null;

var MX_AJAX = function(person, options) {
    const timeout = 1000;
    var isPaused = false;

    var procedures = {
        'CON PERMISO': "11",
        'SIN PERMISO': "12"
    };

    var procedureTypes = {
        TURISMO: "63",
        VINCULO: "77"
    };

    async function waitProcessing() {
        while ($('span:contains("Procesando")').is(':visible'))
            await delay(timeout);
    }

    function notify() {
        var context = new AudioContext();
        var o = context.createOscillator();
        o.type = "sine";
        o.connect(context.destination);
        o.start();
        o.stop(context.currentTime + 1);
    }

    async function delay(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    function random(max) {
        if (options.first)
            return 0;

        if (options.last)
		    return max - 1;

        return Math.floor(Math.random() * max);
    }

    function viewState() {
        return $('[name=javax\\.faces\\.ViewState]').val()
    }

    function captchaValue() {
        if (options.ImNotARobot)
            return $('[name=g-recaptcha-response]').val();
        else
            return $('[name=formRegistroCitaExtranjero\\:answerCaptcha]').val();
    }

    async function setCountry() {
        while (true) {
            if (isPaused) {
                await delay(timeout);
                continue;
            }
            console.log('Setting Country.');

            $('[name=formRegistroCitaExtranjero\\:selectPais_input]').val(17).change();
            await waitProcessing();

            if ($('[name=formRegistroCitaExtranjero\\:selectTipoDocumento_input] option').length > 1)
                break;

            $('[name=formRegistroCitaExtranjero\\:selectPais_input]').val(24).change();
            await waitProcessing();

            await delay(timeout);
        }
    }
    
    async function setCaptcha() {
        console.log('Checking Captcha.');

        notify();
        if (options.ImNotARobot) {
            while (!captchaValue())
                await delay(timeout);
        } else {
            insertJuegala();        
            while (!captchaReady)
                await delay(timeout);
        }
    }

    async function request(payload) {
        payload['javax.faces.ViewState'] = viewState();

        if (options.ImNotARobot)
            payload['g-recaptcha-response'] = captchaValue();
        else
            payload['formRegistroCitaExtranjero:answerCaptcha'] = captchaValue();

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
            if (isPaused) {
                await delay(timeout);
                continue;
            }
            console.log('Setting Document.');

            var html = await request(payload);
            if (html) {
                var form = $(html).find('#formRegistroCitaExtranjero');
                if (form.length) {
                    html = form.html();

                    var regexPro = new RegExp(options.procedure, 'i');
                    if (regexPro.test(html)) break;
                }            
            }

            await delay(timeout);
        }
    }

    async function setProcedure() {
        var payload = Object.assign({}, payloads.procedure);

        payload['formRegistroCitaExtranjero:selectTramite_input'] = procedures[options.procedure];

        while (true) {
            if (isPaused) {
                await delay(timeout);
                continue;
            }
            console.log('Setting Procedure.');

            var html = await request(payload);
            if (html) {
                var form = $(html).find('#formRegistroCitaExtranjero');
                if (form.length) {
                    html = form.html();

                    var regexPro = new RegExp(options.procedure, 'i');
                    if (regexPro.test(html)) break;
                }            
            }

            await delay(timeout);
        }
    }

    async function setNutParam() {
        var payload = Object.assign({}, payloads.setNut);

        payload['formRegistroCitaExtranjero:noPasapNUT'] = person.nut;

        while (true) {
            if (isPaused) {
                await delay(timeout);
                continue;
            }
            console.log('Setting NUT.');

            var html = await request(payload);
            if (html) {
                var input = $(html).find('#formRegistroCitaExtranjero\\:panelnoPasapNUT');
                if (!input.length)
                    continue;

                break;
            }

            await delay(timeout);
        }
    }

    async function setPassParam() {
        var payload = Object.assign({}, payloads.setPass);

        payload['formRegistroCitaExtranjero:noPasapAnt'] = person.passport;

        while (true) {
            if (isPaused) {
                await delay(timeout);
                continue;
            }
            console.log('Setting Passport.');

            var html = await request(payload);
            if (html) {
                var input = $(html).find('#formRegistroCitaExtranjero\\:panelBotonesNut');
                if (!input.length)
                    continue;

                break;
            }

            await delay(timeout);
        }
    }

    async function validateNut() {
        var payload = Object.assign({}, payloads.validateNut);

        payload['formRegistroCitaExtranjero:selectTramite_input'] = procedures[options.procedure];
        payload['formRegistroCitaExtranjero:noPasapAnt'] = person.passport;
        payload['formRegistroCitaExtranjero:noPasapNUT'] = person.nut;

        var invalid = false;
        while (true) {
            if (isPaused) {
                await delay(timeout);
                continue;
            }
            console.log('Validating NUT.');

            var html = await request(payload);
            if (!invalid && html) {
                var message = $(html).find('#formRegistroCitaExtranjero\\:message');
                var regex = /ui-messages-warn-icon/i;

                if (message.length) {
                    if (regex.test(message.text())) {
                        invalid = true;
                    } else break;
                }
            }

            await delay(timeout);
        }
    }

    async function setUserInfo(person) {
        var payload = Object.assign({}, payloads.userInfo);

        payload['formRegistroCitaExtranjero:noPasapAnt'] = person.passport;
        payload['formRegistroCitaExtranjero:selectTramite_input'] = procedures[options.procedure];

        if (options.procedure === 'SIN PERMISO') {
            payload = Object.assign(payload, payloads.userInfoSinPermiso);

            payload['formRegistroCitaExtranjero:nombre'] = person.firstName;
            payload['formRegistroCitaExtranjero:Apellidos'] = person.lastName;
            payload['formRegistroCitaExtranjero:fechaNacimiento_input'] = person.birthdate;
            payload['formRegistroCitaExtranjero:sexo_input'] = person.sex;
            payload['formRegistroCitaExtranjero:selectTipoTramite_input'] = procedureTypes[options.procedureType];
        }

        if (options.procedure === 'CON PERMISO') {
            payload = Object.assign(payload, payloads.userInfoConPermiso);

            payload['formRegistroCitaExtranjero:noPasapNUT'] = person.nut;
        }

        while (true) {
            if (isPaused) {
                await delay(timeout);
                continue;
            }
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
                    if (options.ImNotARobot)
                        grecaptcha.reset()
                    else
                        captchaReady = false;

                    await delay(timeout);
                    await setCaptcha();
                }
            }

            await delay(timeout);
        }
    }

    async function setCalendarWeek(person) {
        var payload = Object.assign({}, payloads.agendaWeek);

        payload['formRegistroCitaExtranjero:noPasapAnt'] = person.passport;
        payload['formRegistroCitaExtranjero:selectTramite_input'] = procedures[options.procedure];

        if (options.procedure === 'SIN PERMISO') {
            payload = Object.assign(payload, payloads.agendaWeekSinPermiso);

            payload['formRegistroCitaExtranjero:selectTipoTramite_input'] = procedureTypes[options.procedureType];
        }

        if (options.procedure === 'CON PERMISO') {
            payload = Object.assign(payload, payloads.agendaWeekConPermiso);

            payload['formRegistroCitaExtranjero:noPasapNUT'] = person.nut;
        }

        while (true) {
            if (isPaused) {
                await delay(timeout);
                continue;
            }
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

            await delay(timeout);
        }
    }

    async function fetchSchedule(person) {
        var payload = Object.assign({}, payloads.schedule);

        payload['formRegistroCitaExtranjero:noPasapAnt'] = person.passport;
        payload['formRegistroCitaExtranjero:selectTramite_input'] = procedures[options.procedure];
        payload['formRegistroCitaExtranjero:schedule_start'] = new Date(2018, 7, 20, 0, 0, 0, 0).getTime().toString();
        payload['formRegistroCitaExtranjero:schedule_end'] = new Date(2018, 7, 31, 0, 0, 0, 0).getTime().toString();

        if (options.procedure === 'SIN PERMISO') {
            payload = Object.assign(payload, payloads.agendaWeekSinPermiso);

            payload['formRegistroCitaExtranjero:selectTipoTramite_input'] = procedureTypes[options.procedureType];
        }

        if (options.procedure === 'CON PERMISO') {
            payload = Object.assign(payload, payloads.agendaWeekConPermiso);

            payload['formRegistroCitaExtranjero:noPasapNUT'] = person.nut;
        }

        while (true) {
            if (isPaused) {
                await delay(timeout);
                continue;
            }
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

            await delay(timeout);
            await setCalendarWeek(person);

            await delay(timeout);
        }
    }

    async function requestAppointment(person, event) {
        var payload = Object.assign({}, payloads.appointment);

        payload["formRegistroCitaExtranjero:noPasapAnt"] = person.passport;
        payload["formRegistroCitaExtranjero:schedule_selectedEventId"] = event;
        payload['formRegistroCitaExtranjero:selectTramite_input'] = procedures[options.procedure];

        if (options.procedure === 'SIN PERMISO') {
            payload = Object.assign(payload, payloads.appointmentSinPermiso);

            payload['formRegistroCitaExtranjero:selectTipoTramite_input'] = procedureTypes[options.procedureType];
        }

        if (options.procedure === 'CON PERMISO') {
            payload = Object.assign(payload, payloads.appointmentConPermiso);

            payload['formRegistroCitaExtranjero:noPasapNUT'] = person.nut;
        }

        while (true) {
            if (isPaused) {
                await delay(timeout);
                continue;
            }
            console.log('Requesting Appointment.');

            var html = await request(payload);
            if (html) {
                var form = $(html).find('#reviewForm');
                if (form.length) break;
            }

            await delay(timeout);
        }
    }

    async function acceptAppointment(token, captcha) {
        var payload = Object.assign({}, payloads.accept);

        payload["reviewForm:confirmToken"] = token;
        payload["reviewForm:confirmCodigoSeguridad"] = captcha;

        while (true) {
            if (isPaused) {
                await delay(timeout);
                continue;
            }
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

            await delay(timeout);
        }
    }

    return { 
        process: async function() {
            await setCountry();
            await delay(timeout);

            await setDocument();
            await delay(timeout);

            await setProcedure();
            await delay(timeout);

            if (options.procedure === 'CON PERMISO') {
                await setNutParam();
                await delay(timeout);

                await setPassParam();
                await delay(timeout);

                await validateNut();
                await delay(timeout);
            }

            await setCaptcha();
            await delay(6 * timeout);

            await setUserInfo(person);
            await delay(timeout);

            while (true) {
                await setCalendarWeek(person);
                await delay(timeout);

                var events = await fetchSchedule(person);
                await delay(timeout);

                var index = random(events.length);
                var event = events[index];
    
                await requestAppointment(person, event.id);
                var tc = await options.tokenCode();
                await delay(timeout);
                
                if (await acceptAppointment(tc.token, tc.captcha)) break;
                await delay(timeout);
            }
        },
        play: function() {
            isPaused = false;
        },
        pause: function() {
            isPaused = true;
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
    userInfoConPermiso: {
        "formRegistroCitaExtranjero:noPasapNUT": ""
    },
    validateNut: {
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "formRegistroCitaExtranjero:btnValidarNUT",
        "javax.faces.partial.execute": "formRegistroCitaExtranjero:noPasapAnt formRegistroCitaExtranjero:noPasapNUT formRegistroCitaExtranjero:btnValidarNUT",
        "javax.faces.partial.render": "formRegistroCitaExtranjero:panelDatosUsuario formRegistroCitaExtranjero:btnValidarNUT formRegistroCitaExtranjero:buscarCita formRegistroCitaExtranjero:limpiarCita formRegistroCitaExtranjero:message formRegistroCitaExtranjero:panelBotonesNut",
        "formRegistroCitaExtranjero:btnValidarNUT": "formRegistroCitaExtranjero:btnValidarNUT",
        "formRegistroCitaExtranjero": "formRegistroCitaExtranjero",
        "formRegistroCitaExtranjero:selectPais_focus": "",
        "formRegistroCitaExtranjero:selectPais_input": "17",
        "formRegistroCitaExtranjero:selectSedeUbicacion_filter": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_focus": "",
        "formRegistroCitaExtranjero:selectTipoDocumento_input": "4",
        "formRegistroCitaExtranjero:selectTramite_focus": "",
        "formRegistroCitaExtranjero:selectTramite_input": "",
        "formRegistroCitaExtranjero:noPasapNUT": "",
        "formRegistroCitaExtranjero:noPasapAnt": "",
        "javax.faces.ViewState": ""
    },
    setNut: {
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "formRegistroCitaExtranjero:noPasapNUT",
        "primefaces.resetvalues": "true",
        "javax.faces.partial.execute": "formRegistroCitaExtranjero:noPasapNUT",
        "javax.faces.partial.render": "formRegistroCitaExtranjero:panelnoPasapNUT",
        "javax.faces.behavior.event": "change",
        "javax.faces.partial.event": "change",
        "formRegistroCitaExtranjero:noPasapNUT": "",
        "javax.faces.ViewState": "" 
    },
    setPass: {
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "formRegistroCitaExtranjero:noPasapAnt",
        "primefaces.resetvalues": "true",
        "javax.faces.partial.execute": "formRegistroCitaExtranjero:noPasapAnt",
        "javax.faces.partial.render": "formRegistroCitaExtranjero:panelnoPasapAnt formRegistroCitaExtranjero:panelBotonesNut",
        "javax.faces.behavior.event": "change",
        "javax.faces.partial.event": "change",
        "formRegistroCitaExtranjero:noPasapAnt": "",
        "javax.faces.ViewState": ""
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
    agendaWeekConPermiso: {
        "formRegistroCitaExtranjero:noPasapNUT": ""
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
    scheduleConPermiso: {
        "formRegistroCitaExtranjero:noPasapNUT": ""
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
    appointmentConPermiso: {
        "formRegistroCitaExtranjero:noPasapNUT": ""
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