// Lógica: input USD -> desglose (impuesto, comisión) -> total USD y Lempiras
(function(){
	const $ = (s) => document.querySelector(s);
	const priceUSD = $('#priceUSD');
	// Valores fijos (según solicitud): tipo de cambio, impuesto y comisión
	const EXCHANGE_RATE = 26.4241; // Lempiras por 1 USD
	const TAX_PERCENT = 7.5; // %
	const COMMISSION_PERCENT = 25; // %
	const invPrice = $('#invPrice');
	const invTax = $('#invTax');
	const invCommission = $('#invCommission');
	const invTotalUSD = $('#invTotalUSD');
	const invTotalL = $('#invTotalL');
	const totalL = $('#totalL');
	const generateBtn = $('#generateBtn');
	const pdfBtn = $('#pdfBtn');
	const resetBtn = $('#resetBtn');
	const cardsContainer = $('#cardsContainer');
	const grandTotalInput = $('#grandTotalL');

	function toNumber(v){ return Number(v) || 0 }
	function fmtUSD(n){ return '$' + n.toFixed(2) }
	function fmtL(n){ return 'L.' + n.toFixed(2) }

	function calculate(){
		const price = toNumber(priceUSD.value);
		const rate = EXCHANGE_RATE;
		const taxR = TAX_PERCENT / 100;
		const commR = COMMISSION_PERCENT / 100;

		// impuesto sobre el precio
		const tax = price * taxR;
		// comisión aplicada sobre (precio + impuesto)
		const commission = (price + tax) * commR;
		const totalUSDval = price + tax + commission;
		const totalLval = totalUSDval * rate;

		// actualizar invoice
		invPrice.textContent = fmtUSD(price);
		invTax.textContent = fmtUSD(tax);
		invCommission.textContent = fmtUSD(commission);
		invTotalUSD.textContent = fmtUSD(totalUSDval);
		invTotalL.textContent = fmtL(totalLval);
		totalL.textContent = fmtL(totalLval);

		// guardar valores crudos para uso al generar tarjetas
		lastTotals = { price, tax, commission, totalUSD: totalUSDval, totalL: totalLval };
	}

	// recalcular solo cuando cambie el precio USD
	[priceUSD].forEach(el => el.addEventListener('input', calculate));

	// behavior: if the field is empty, clear the placeholder on focus
	priceUSD.addEventListener('focus', () => {
		if (priceUSD.value === '') priceUSD.placeholder = '';
		// optional: select existing content if any
	});
	// restore placeholder on blur when still empty
	priceUSD.addEventListener('blur', () => {
		if (priceUSD.value === '') priceUSD.placeholder = '0.00';
	});

	// generar tarjetas y actualizar acumulado
	let runningTotalL = 0;
	let lastTotals = { price:0, tax:0, commission:0, totalUSD:0, totalL:0 };
	let cardsList = []; // guardará los datos de las tarjetas para el reporte

	generateBtn.addEventListener('click', ()=>{
		const vals = lastTotals;
		// evitar agregar tarjetas con valor cero
		if (!vals || vals.totalUSD <= 0) {
			alert('Ingresa un precio válido mayor a 0 antes de agregar la tarjeta.');
			return;
		}

		// crear tarjeta visual
		const card = document.createElement('div');
		card.className = 'card';

		const left = document.createElement('div'); left.className = 'left';
		const title = document.createElement('div'); title.textContent = fmtUSD(vals.price) + ' — Total USD: ' + fmtUSD(vals.totalUSD);
		const meta = document.createElement('div'); meta.className = 'meta';
		meta.innerHTML = 'Impuesto: ' + fmtUSD(vals.tax) + ' • Comisión: ' + fmtUSD(vals.commission);
		left.appendChild(title); left.appendChild(meta);

		const rightWrap = document.createElement('div'); rightWrap.style.display = 'flex'; rightWrap.style.alignItems = 'center';
		const right = document.createElement('div'); right.className = 'amount'; right.textContent = fmtL(vals.totalL);

		// botón eliminar
		const del = document.createElement('button');
		del.type = 'button';
		del.className = 'delete-btn';
		del.textContent = 'Eliminar';

		rightWrap.appendChild(right);
		rightWrap.appendChild(del);
		card.appendChild(left); card.appendChild(rightWrap);
		cardsContainer.appendChild(card);

		// actualizar acumulado
		runningTotalL += vals.totalL;
		grandTotalInput.value = fmtL(runningTotalL);

		// generar id único para la tarjeta y almacenar datos en la lista (para el reporte)
		const cardId = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
		const cardData = { id: cardId, price: vals.price, tax: vals.tax, commission: vals.commission, totalUSD: vals.totalUSD, totalL: vals.totalL, createdAt: new Date().toISOString() };
		cardsList.push(cardData);
		card.dataset.id = cardId;

		// eliminar: buscar en cardsList y quitar el registro también
		del.addEventListener('click', ()=>{
			const id = card.dataset.id;
			const idx = cardsList.findIndex(x => x.id === id);
			if(idx !== -1){
				const item = cardsList[idx];
				runningTotalL = Math.max(0, runningTotalL - item.totalL);
				cardsList.splice(idx, 1);
			}else{
				// fallback: usar vals
				runningTotalL = Math.max(0, runningTotalL - vals.totalL);
			}
			grandTotalInput.value = fmtL(runningTotalL);
			card.remove();
		});

		// opcional: limpiar campo precio para evitar duplicados accidentales
		priceUSD.value = '';
		calculate();
	});

	// generar PDF con los datos de las tarjetas usando autoTable e incluyendo logo e información
	function generatePdf(){
		if(!cardsList.length){
			alert('No hay productos agregados para generar el reporte.');
			return;
		}

		const { jsPDF } = window.jspdf;

		// cargar logo primero (si falla, generamos sin logo)
		const img = new Image();
		img.src = 'img/logo.png';
		img.crossOrigin = 'anonymous';

		const buildDoc = (imgLoaded) => {
			const doc = new jsPDF();

			// header: logo (si está), nombre y contactos
			if(imgLoaded){
				try{
					// logo ligeramente más grande para el encabezado (anchura x altura)
					const logoW = 40;
					const logoH = 40;
					// dibujar logo un poco más arriba para que quede centrado con el texto
					doc.addImage(img, 'PNG', 14, 8, logoW, logoH);
				}catch(e){
					// continuar sin logo si hay error
				}
			}

			doc.setFontSize(14);
			// calcular la X del header para dejar espacio después del logo
			const logoW = 40;
			// aumentar separación horizontal entre logo y texto
			const headerX = imgLoaded ? (14 + logoW + 20) : 14;
			doc.text('Orchid', headerX, 20);
			doc.setFontSize(10);
			doc.text('Whatsapp: 3264-2063  |  8764-5599', headerX, 30);
			doc.text('Fecha: ' + new Date().toLocaleString(), headerX, 38);

			// construir datos para autoTable
			const head = [["#","Precio (USD)","Impuesto (USD)","Comisión (USD)","Total (USD)","Total (L)","Fecha"]];
			const body = cardsList.map((c, i) => {
				return [
					String(i+1),
					fmtUSD(c.price),
					fmtUSD(c.tax),
					fmtUSD(c.commission),
					fmtUSD(c.totalUSD),
					fmtL(c.totalL),
					new Date(c.createdAt).toLocaleString()
				];
			});

			doc.autoTable({
				// iniciar la tabla (ajustado): menos espacio entre header/logo y la tabla
				startY: 72,
				head: head,
				body: body,
				styles: { fontSize: 9 },
				headStyles: { fillColor: [27, 94, 32], textColor: 255 },
				alternateRowStyles: { fillColor: [250,250,248] },
				margin: { left: 14, right: 14 }
			});

			const finalY = doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : 72;
			doc.setFontSize(12);
			doc.text('Total acumulado (L.): ' + grandTotalInput.value, 14, finalY + 10);
			doc.setFontSize(9);
			doc.text('*Total final varia segun el peso del producto/productos', 14, finalY + 18);
			doc.save('factura_productos.pdf');
		};

		img.onload = () => buildDoc(true);
		img.onerror = () => buildDoc(false);
	}

	pdfBtn.addEventListener('click', generatePdf);

	resetBtn.addEventListener('click', ()=>{
		priceUSD.value = '';
		// limpiar tarjetas, lista y acumulado
		cardsContainer.innerHTML = '';
		cardsList = [];
		runningTotalL = 0;
		grandTotalInput.value = fmtL(0);
		// recalcular vista
		calculate();
	});

	// init
	document.addEventListener('DOMContentLoaded', calculate);
	calculate();

})();
