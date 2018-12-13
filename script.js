var tasks = [];
var timeout = 500;
var passport = 'X123456';
var firstName = 'TEST';
var lastName = 'USER';
var birthday = 'DD/MM/YYYY';
var sex = 0;

function start() {
    keepAlive();

	tasks = getTasks();
	process().then(function() {
		console.log('Done!');
	})
}

async function process() {
    var index = 0;
    var captchaIndex = tasks.findIndex(t => t.name.includes("reCAPTCHA"));

    while (index < tasks.length) {
        var task = tasks[index];

        console.log(task.name);
        var isSuccess = await task.action();

        if (isSuccess)
            index++;
        else if (index > captchaIndex)
            index = captchaIndex - 1;
        else
            index = 0;
    }
}

function getTasks() {
    var tasks = [];

    tasks.push({ action: clear, name: "Clearing" });
    tasks.push({ action: country, name: "Setting CUBA" });
    tasks.push({ action: documents, name: "Setting VISAS" });
    tasks.push({ action: procedure, name: "Setting SIN PERMISO DE INM" });
    //tasks.push({ action: detail, name: "Setting TURISMO" });
    tasks.push({ action: userInfo, name: "Setting USER" });
    tasks.push({ action: notify, name: "Notify!!!" });
    tasks.push({ action: reCaptcha, name: "Checking reCAPTCHA" });
    tasks.push({ action: appoinment, name: "Searching APPOINTMENTS" });
    tasks.push({ action: dates, name: "Setting DATE" });
    tasks.push({ action: times, name: "Setting TIME" });

    return tasks;
}

async function clear() {
    return select('[name=formRegistroCitaExtranjero\\:selectPais_input]', 'ESTADOS UNIDOS');
}

async function country() {
    return select('[name=formRegistroCitaExtranjero\\:selectPais_input]', 'CUBA');
}

async function documents() {
    return select('[name=formRegistroCitaExtranjero\\:selectTipoDocumento_input]', 'VISAS');
}

async function procedure() {
    return select('[name=formRegistroCitaExtranjero\\:selectTramite_input]', 'SIN PERMISO');
}

async function detail() {
    return select('[name=formRegistroCitaExtranjero\\:selectTipoTramite_input]', 'TURISMO');
}

async function userInfo() {
    set('[name=formRegistroCitaExtranjero\\:selectPaisPasaporte_input]', 'CUBA');
    set('[name=formRegistroCitaExtranjero\\:selectNacionalidad_input]', 'CUBA');
    set('[name=formRegistroCitaExtranjero\\:selectPaisNacimiento_input]', 'CUBA');
    set('[name=formRegistroCitaExtranjero\\:selectTipoTramite_input]', 'TURISMO');

    $('[name=formRegistroCitaExtranjero\\:noPasapAnt]').val(passport);
    $('[name=formRegistroCitaExtranjero\\:nombre]').val(firstName.toUpperCase());
    $('[name=formRegistroCitaExtranjero\\:Apellidos]').val(lastName.toUpperCase());
    $('[name=formRegistroCitaExtranjero\\:fechaNacimiento_input]').val(birthday);
    $('[name=formRegistroCitaExtranjero\\:sexo_input]').val(sex);
    return Promise.resolve(true);
}

async function notify() {
	var context = new AudioContext();
	var o = context.createOscillator();
	o.type = "sine";
	o.connect(context.destination);
	o.start();
	o.stop(context.currentTime + 2);

	return Promise.resolve(true);
}

async function reCaptcha() {
	while (!($("[name=g-recaptcha-response]").val()))
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

async function times() {
	return calendar('div.fc-agendaDay-view', '[name=formRegistroCitaExtranjero\\:Day]');
}

function keepAlive() {
	setTimeout(function() {
		ajaxAlive();
		keepAlive();
	}, 5 * 60 * 1000);
}

async function waitProcessing() {
	while ($('span:contains("Procesando")').is(':visible'))
		await delay(timeout);

	await delay(50);
	return true;
}

async function calendar(type, reset) {
	var retry = 10;
	while (retry-->0) {
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

		$(reset).click()
		await waitProcessing();
	}

	return Promise.resolve(false);
}

async function select(select, option, force = false) {
	select = $(select);
	option = select.find('option:contains("'+option+'")');
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

start();