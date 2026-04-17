const schedule2026_04 = {
    "Устименко Ю.": ["9-18", "9-18", "11-20", "off", "10-19", "off", "9-18", "11-20", "9-18", "9-18", "off", "off", "9-18", "9-18", "9-18", "9-18", "10-19", "off", "off", "11-20", "9-18", "9-18", "10-19", "off", "11-20", "9-18", "11-20", "9-18", "10-19", "off"],
    "Стосяк А.": ["9-18", "9-18", "off", "10-19", "off", "9-18", "off", "9-18", "9-18", "11-20", "off", "10-19", "9-18", "off", "9-18", "9-18", "off", "off", "11-20", "9-18", "9-18", "off", "9-18", "9-18", "11-20", "off", "9-18", "9-18", "10-19", "off"],
    "Піддубцева Ю.": ["9-18", "9-18", "9-18", "off", "off", "9-18", "9-18", "9-18", "11-20", "9-18", "off", "10-19", "9-18", "9-18", "9-18", "11-20", "off", "off", "10-19", "9-18", "9-18", "11-20", "9-18", "9-18", "off", "10-19", "9-18", "9-18", "9-18", "9-18"],
    "Меделянова Н.": ["11-20", "9-18", "9-18", "off", "off", "11-20", "9-18", "off", "off", "off", "10-19", "off", "11-20", "9-18", "9-18", "9-18", "off", "10-19", "9-18", "9-18", "9-18", "9-18", "9-18", "off", "10-19", "9-18", "9-18", "9-18", "9-18", "off"],
    "Михайленко Ю.": ["9-18", "9-18", "9-18", "10-19", "off", "off", "9-18", "9-18", "9-18", "9-18", "10-19", "off", "off", "9-18", "11-20", "9-18", "off", "10-19", "9-18", "9-18", "off", "9-18", "11-20", "off", "9-18", "11-20", "9-18", "9-18", "9-18", "off"],
    "Папроцька І.": ["9-18", "11-20", "off", "off", "10-19", "9-18", "11-20", "9-18", "9-18", "9-18", "off", "off", "9-18", "11-20", "9-18", "9-18", "10-19", "off", "9-18", "off", "9-18", "11-20", "9-18", "off", "off", "9-18", "9-18", "9-18", "9-18", "off"]
};

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    // 0 = January, 3 = April
    if (today.getMonth() === 3 && today.getFullYear() === 2026) {
        const dayIndex = today.getDate() - 1; // 1.4 -> index 0
        
        const engineers = document.querySelectorAll('.engineer-row');
        engineers.forEach(row => {
            const engName = row.getAttribute('data-eng');
            if (schedule2026_04[engName]) {
                const shift = schedule2026_04[engName][dayIndex];
                if (shift === "off") {
                    row.style.display = 'none'; // Hide if off!
                } else {
                    // Inject a span indicating their shift
                    const nameStrong = row.querySelector('strong');
                    if (nameStrong) {
                        const shiftBadge = document.createElement('span');
                        shiftBadge.innerHTML = '&nbsp;🕒&nbsp;' + shift.replace('-', '‑'); // Using non-breaking hyphen just in case
                        shiftBadge.style.fontSize = '0.8rem';
                        shiftBadge.style.color = 'var(--ks-blue)';
                        shiftBadge.style.fontWeight = 'normal';
                        shiftBadge.style.whiteSpace = 'nowrap';
                        nameStrong.appendChild(shiftBadge);
                    }
                }
            }
        });
        
        // Hide region headers if all engineers below it are offline
        const ukraineEngineers = document.querySelectorAll('.engineer-row[data-region="ukraine"]');
        const kharkovEngineers = document.querySelectorAll('.engineer-row[data-region="kharkov"]');
        
        let ukraineHasOnline = false;
        ukraineEngineers.forEach(row => { if(row.style.display !== 'none') ukraineHasOnline = true; });
        if (!ukraineHasOnline) {
            const uHeader = document.getElementById('header-ukraine');
            if(uHeader) uHeader.style.display = 'none';
        }
        
        let kharkovHasOnline = false;
        kharkovEngineers.forEach(row => { if(row.style.display !== 'none') kharkovHasOnline = true; });
        if (!kharkovHasOnline) {
            const kHeader = document.getElementById('header-kharkov');
            if(kHeader) kHeader.style.display = 'none';
        }
    }
});
