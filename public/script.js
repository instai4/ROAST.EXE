/* ── CURSOR ── */
const cur = document.getElementById('cursor');
const trail = document.getElementById('cursor-trail');
document.addEventListener('mousemove', e => {
    cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px';
    setTimeout(() => { trail.style.left = e.clientX + 'px'; trail.style.top = e.clientY + 'px'; }, 80);
});
document.querySelectorAll('a,button,.mode-tab,.intensity-btn,.persona-btn').forEach(el => {
    el.addEventListener('mouseenter', () => { cur.style.width = '34px'; cur.style.height = '34px'; cur.style.background = 'rgba(255,69,0,.18)'; });
    el.addEventListener('mouseleave', () => { cur.style.width = '14px'; cur.style.height = '14px'; cur.style.background = 'rgba(255,69,0,.3)'; });
});

/* ── STATE ── */
let currentMode = 'bio';
let currentIntensity = 'savage';
let currentPersona = 'comedian';
let photoBase64 = null;
let lastRoastData = null;

const personaMeta = {
    comedian: { name: 'The Comedian', icon: '<i class="fa-solid fa-microphone"></i>' },
    gordon: { name: 'Gordon Ramsay', icon: '<i class="fa-solid fa-utensils"></i>' },
    shakespeare: { name: 'Shakespeare', icon: '<i class="fa-solid fa-feather-pointed"></i>' },
    drill: { name: 'Drill Sergeant', icon: '<i class="fa-solid fa-person-military-pointing"></i>' },
    therapist: { name: 'The Therapist', icon: '<i class="fa-solid fa-brain"></i>' },
    'gen-z': { name: 'Gen-Z Critic', icon: '<i class="fa-solid fa-mobile-screen"></i>' },
    ai: { name: 'Cold AI', icon: '<i class="fa-solid fa-robot"></i>' },
    villain: { name: 'The Villain', icon: '<i class="fa-solid fa-chess-king"></i>' },
};

/* ── MODE ── */
function setMode(m) {
    currentMode = m;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === m));
    document.querySelectorAll('.input-panel').forEach(p => p.classList.remove('show'));
    document.getElementById('panel-' + m).classList.add('show');
}

/* ── INTENSITY ── */
function setIntensity(i) {
    currentIntensity = i;
    document.querySelectorAll('.intensity-btn').forEach(b => b.classList.toggle('active', b.dataset.i === i));
}

/* ── PERSONA ── */
function setPersona(p) {
    currentPersona = p;
    document.querySelectorAll('.persona-btn').forEach(b => b.classList.toggle('active', b.dataset.p === p));
}

/* ── PHOTO HANDLER ── */
function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
        const maxWidth = 512;
        const scale = maxWidth / img.width;

        canvas.width = maxWidth;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const compressed = canvas.toDataURL('image/jpeg', 0.6);

        photoBase64 = compressed.split(',')[1];

        const prev = document.getElementById('photo-preview');
        prev.src = compressed;
        prev.style.display = 'block';

        document.getElementById('upload-icon').style.display = 'none';
        document.getElementById('upload-label').style.display = 'none';
    };

    img.src = URL.createObjectURL(file);
}

// drag-drop
const drop = document.getElementById('photo-drop');
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        document.getElementById('photo-file').files = e.dataTransfer.files;
        handlePhoto({ target: { files: [file] } });
    }
});

/* ── BUILD PAYLOAD ── */
function buildPayload() {
    const base = { mode: currentMode, intensity: currentIntensity, persona: currentPersona };
    if (currentMode === 'bio') {
        base.content = document.getElementById('bio-input').value.trim();
    } else if (currentMode === 'photo') {
        base.photoBase64 = photoBase64;
        base.content = document.getElementById('photo-context').value.trim();
    } else if (currentMode === 'github') {
        base.url = document.getElementById('github-url').value.trim();
        base.content = document.getElementById('github-bio').value.trim();
    } else if (currentMode === 'linkedin') {
        base.url = document.getElementById('linkedin-url').value.trim();
        base.content = document.getElementById('linkedin-about').value.trim();
    }
    return base;
}

/* ── VALIDATE ── */
function validate(payload) {
    if (payload.mode === 'bio' && !payload.content)
        return 'Please write something about yourself first.';
    if (payload.mode === 'photo' && !payload.photoBase64)
        return 'Please upload a photo first.';
    if (payload.mode === 'github' && !payload.url && !payload.content)
        return 'Please enter a GitHub URL or paste your GitHub bio.';
    if (payload.mode === 'linkedin' && !payload.url && !payload.content)
        return 'Please enter your LinkedIn URL or paste your About section.';
    return null;
}

/* ── THINKING MESSAGES ── */
const thinkingLines = [
    'Loading ammunition...',
    'Sharpening the insults...',
    'Consulting the roast archive...',
    'Finding your weaknesses...',
    'Preparing emotional damage...',
    'Calibrating burn intensity...',
    'This is going to hurt...',
];
let thinkingInterval;
function startThinking() {
    const el = document.getElementById('thinking-msgs');
    el.innerHTML = '';
    let i = 0;
    const addMsg = () => {
        if (i >= thinkingLines.length) return;
        const div = document.createElement('div');
        div.className = 'thinking-msg';
        div.innerHTML = `<i class="fa-solid fa-fire-flame-curved"></i> ${thinkingLines[i]}`;
        el.appendChild(div);
        el.scrollTop = el.scrollHeight;
        i++;
    };
    addMsg();
    thinkingInterval = setInterval(addMsg, 900);
}
function stopThinking() {
    clearInterval(thinkingInterval);
    document.getElementById('thinking-msgs').innerHTML = '';
}

/* ── TRIGGER ROAST ── */
async function triggerRoast() {
    const payload = buildPayload();
    const err = validate(payload);
    if (err) { alert(err); return; }

    // hide old card
    document.getElementById('roast-card').classList.remove('show');
    const btn = document.getElementById('roast-btn');
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ROASTING...';
    document.getElementById('loading-bar').classList.add('show');
    startThinking();

    try {
        const res = await fetch('/api/roast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await res.text(); // ✅ ALWAYS READ TEXT FIRST

        let data;
        try {
            data = JSON.parse(text); // ✅ SAFE PARSE
        } catch (err) {
            console.error('Non-JSON response:', text);
            throw new Error(text.slice(0, 100)); // show real error
        }

        if (!res.ok) {
            throw new Error(data?.error || 'Server error');
        }

        lastRoastData = data;
        displayRoast(data);

    } catch (e) {
        stopThinking();
        alert('Roast failed: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.innerHTML = '<i class="fa-solid fa-fire-flame-curved"></i> ROAST ME';
        document.getElementById('loading-bar').classList.remove('show');
        stopThinking();
    }
}

/* ── DISPLAY ROAST ── */
function displayRoast(data) {
    const card = document.getElementById('roast-card');
    const meta = personaMeta[currentPersona];

    // persona header
    document.getElementById('persona-icon-display').innerHTML = meta.icon;
    document.getElementById('persona-name-display').textContent = meta.name;

    // intensity tag
    const tag = document.getElementById('intensity-tag-display');
    tag.textContent = currentIntensity.charAt(0).toUpperCase() + currentIntensity.slice(1);
    tag.className = 'intensity-tag ' + currentIntensity;

    // roast text — split into paragraphs
    const roastEl = document.getElementById('roast-output');
    const lines = (data.roast || '').split('\n').filter(l => l.trim());
    roastEl.innerHTML = lines.map(l => `<p>${l}</p>`).join('');

    // burn score
    const score = Math.min(10, Math.max(1, data.burnScore || 7));
    document.getElementById('burn-score-val').textContent = score + '/10';
    setTimeout(() => {
        document.getElementById('burn-fill').style.width = (score * 10) + '%';
    }, 100);

    card.classList.add('show');

    // nuclear shake
    if (currentIntensity === 'nuclear') {
        card.classList.add('nuke-shake');
        setTimeout(() => card.classList.remove('nuke-shake'), 400);
    }

    // scroll to card
    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

/* ── COPY ── */
function copyRoast() {
    if (!lastRoastData) return;
    navigator.clipboard.writeText(lastRoastData.roast || '').then(() => {
        const btn = document.getElementById('copy-btn');
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Roast';
        }, 2000);
    });
}

/* ── SHARE X ── */
function shareX() {
    if (!lastRoastData) return;
    const text = encodeURIComponent(
        (lastRoastData.roast || '').slice(0, 240) +
        '\n\n— Roasted by ROAST.exe · ANURAG.exe'
    );
    window.open('https://x.com/intent/tweet?text=' + text, '_blank');
}

/* ── ROAST AGAIN (same input, new roast) ── */
async function roastAgain() {
    document.getElementById('roast-card').classList.remove('show');
    await triggerRoast();
}

/* ── NEW ROAST (reset everything) ── */
function newRoast() {
    document.getElementById('roast-card').classList.remove('show');
    document.getElementById('bio-input').value = '';
    document.getElementById('photo-context').value = '';
    document.getElementById('github-url').value = '';
    document.getElementById('github-bio').value = '';
    document.getElementById('linkedin-url').value = '';
    document.getElementById('linkedin-about').value = '';
    document.getElementById('photo-preview').style.display = 'none';
    document.getElementById('upload-icon').style.display = '';
    document.getElementById('upload-label').style.display = '';
    document.getElementById('burn-fill').style.width = '0%';
    photoBase64 = null;
    lastRoastData = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
