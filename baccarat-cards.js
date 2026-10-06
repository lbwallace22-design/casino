(function (root) {
  'use strict';

  const W = 250;
  const H = 350;
  const SCALE = 2;
  const textures = new Map();
  const RED = '#9b2130';
  const BLACK = '#17242d';

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function suit(ctx, symbol, x, y, size, inverted = false, color) {
    ctx.save();
    ctx.translate(x, y);
    if (inverted) ctx.rotate(Math.PI);
    ctx.scale(size / 40, size / 40);
    ctx.fillStyle = color || (symbol === 'H' || symbol === 'D' ? RED : BLACK);
    ctx.beginPath();
    if (symbol === 'D') {
      ctx.moveTo(0, -23); ctx.lineTo(17, 0); ctx.lineTo(0, 23); ctx.lineTo(-17, 0);
    } else if (symbol === 'H') {
      ctx.moveTo(0, 20);
      ctx.bezierCurveTo(-7, 11, -22, 1, -20, -11);
      ctx.bezierCurveTo(-18, -24, -4, -24, 0, -13);
      ctx.bezierCurveTo(4, -24, 18, -24, 20, -11);
      ctx.bezierCurveTo(22, 1, 7, 11, 0, 20);
    } else if (symbol === 'S') {
      ctx.moveTo(0, -23);
      ctx.bezierCurveTo(7, -13, 22, -4, 20, 7);
      ctx.bezierCurveTo(18, 18, 6, 18, 2, 9);
      ctx.bezierCurveTo(3, 16, 4, 19, 9, 22);
      ctx.lineTo(-9, 22);
      ctx.bezierCurveTo(-4, 19, -3, 16, -2, 9);
      ctx.bezierCurveTo(-6, 18, -18, 18, -20, 7);
      ctx.bezierCurveTo(-22, -4, -7, -13, 0, -23);
    } else {
      ctx.arc(0, -12, 11, 0, Math.PI * 2);
      ctx.moveTo(-1, 4); ctx.arc(-12, 4, 11, 0, Math.PI * 2);
      ctx.moveTo(23, 4); ctx.arc(12, 4, 11, 0, Math.PI * 2);
      ctx.moveTo(-3, 3); ctx.lineTo(3, 3); ctx.quadraticCurveTo(1, 15, 10, 22);
      ctx.lineTo(-10, 22); ctx.quadraticCurveTo(-1, 15, -3, 3);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function makeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    return { canvas, ctx };
  }

  function paper(ctx) {
    roundRect(ctx, 1, 1, W - 2, H - 2, 13);
    const cream = ctx.createLinearGradient(0, 0, W, H);
    cream.addColorStop(0, '#fffef6'); cream.addColorStop(0.5, '#f7f4e9'); cream.addColorStop(1, '#e8e4d8');
    ctx.fillStyle = cream; ctx.fill();
    ctx.strokeStyle = '#c8c4b7'; ctx.lineWidth = 1.4; ctx.stroke();
    roundRect(ctx, 3, 3, W - 6, H - 6, 11);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(83, 65, 36, .035)';
    for (let y = 9; y < H - 8; y += 5) {
      for (let x = 9 + (y % 3); x < W - 8; x += 7) ctx.fillRect(x, y, .65, .65);
    }
  }

  function index(ctx, rank, symbol) {
    ctx.fillStyle = symbol === 'H' || symbol === 'D' ? RED : BLACK;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${rank === '10' ? 24 : 28}px Georgia, serif`;
    ctx.fillText(rank, 24, 30);
    suit(ctx, symbol, 24, 57, 21);
  }

  function courtHalf(ctx, rank, symbol) {
    const ink = symbol === 'D' || symbol === 'H' ? RED : BLACK;
    const gold = '#b79245';
    ctx.save(); ctx.translate(125, 138);
    ctx.lineWidth = 1.3; ctx.strokeStyle = ink; ctx.fillStyle = '#d9b965';
    // Embroidered robe and contrasting sash.
    ctx.beginPath(); ctx.moveTo(-61, 37); ctx.lineTo(-46, -4); ctx.lineTo(-18, -17);
    ctx.lineTo(17, -17); ctx.lineTo(47, -2); ctx.lineTo(61, 37); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.moveTo(-42, -5); ctx.lineTo(-15, -17); ctx.lineTo(42, 37);
    ctx.lineTo(10, 37); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f0dc99'; ctx.lineWidth = 2;
    for (let offset = -22; offset <= 25; offset += 9) {
      ctx.beginPath(); ctx.moveTo(offset - 18, -8); ctx.lineTo(offset + 27, 37); ctx.stroke();
    }
    ctx.strokeStyle = ink; ctx.lineWidth = 1;
    for (let x = -52; x <= 52; x += 13) {
      ctx.beginPath(); ctx.moveTo(x, 19); ctx.lineTo(x + 5, 27); ctx.lineTo(x, 35); ctx.lineTo(x - 5, 27); ctx.closePath(); ctx.stroke();
    }
    // Hair, face, profile, and engraved facial features.
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.ellipse(0, -38, 23, 28, -.07, 0, Math.PI * 2); ctx.fill();
    if (rank === 'Q') {
      ctx.beginPath(); ctx.ellipse(-20, -21, 11, 27, .3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(20, -21, 11, 27, -.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = gold;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(-18, -29 + k * 8, 6, .1, 5.4); ctx.stroke(); }
    }
    ctx.fillStyle = '#f3e6c7'; ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.moveTo(-14, -56); ctx.quadraticCurveTo(12, -67, 16, -48);
    ctx.lineTo(15, -38); ctx.lineTo(21, -32); ctx.lineTo(14, -29);
    ctx.quadraticCurveTo(14, -10, 1, -10); ctx.quadraticCurveTo(-15, -17, -14, -56); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -43); ctx.quadraticCurveTo(7, -47, 12, -42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -28); ctx.lineTo(13, -27); ctx.stroke();
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(8, -41, 1.5, 0, Math.PI * 2); ctx.fill();
    if (rank === 'K') {
      ctx.beginPath(); ctx.moveTo(-11, -28); ctx.quadraticCurveTo(1, -18, 14, -25);
      ctx.lineTo(10, -12); ctx.lineTo(0, -3); ctx.lineTo(-9, -13); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = gold;
      for (let k = -5; k <= 7; k += 4) { ctx.beginPath(); ctx.moveTo(k, -22); ctx.lineTo(k + 2, -12); ctx.stroke(); }
    }
    // A distinct crown or Jack's feathered cap.
    ctx.fillStyle = gold; ctx.strokeStyle = ink;
    if (rank === 'J') {
      ctx.beginPath(); ctx.moveTo(-25, -52); ctx.quadraticCurveTo(-12, -81, 12, -70);
      ctx.lineTo(26, -54); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f8f1d8'; ctx.beginPath(); ctx.ellipse(-8, -77, 5, 16, -.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-23, -55); ctx.lineTo(-25, -74); ctx.lineTo(-12, -65);
      ctx.lineTo(-7, -82); ctx.lineTo(3, -66); ctx.lineTo(17, -79); ctx.lineTo(18, -62);
      ctx.lineTo(27, -70); ctx.lineTo(23, -55); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink;
      for (const x of [-14, 1, 16]) { ctx.beginPath(); ctx.arc(x, -59, 2.3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.strokeStyle = gold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-47, -51); ctx.lineTo(-47, 31); ctx.stroke();
    if (rank === 'Q') {
      for (let k = 0; k < 6; k++) {
        ctx.save(); ctx.translate(-47, -48); ctx.rotate(k * Math.PI / 3);
        ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(0, -6, 3, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    } else {
      ctx.fillStyle = '#f1e1af'; ctx.beginPath(); ctx.moveTo(-47, -72); ctx.lineTo(-42, -55);
      ctx.lineTo(-47, -45); ctx.lineTo(-52, -55); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    suit(ctx, symbol, 48, -47, 22);
    ctx.restore();
  }

  function faceTexture(card) {
    const key = card.rank + card.suit;
    if (textures.has(key)) return textures.get(key);
    const { canvas, ctx } = makeTexture();
    paper(ctx);
    index(ctx, card.rank, card.suit);
    ctx.save(); ctx.translate(W, H); ctx.rotate(Math.PI); index(ctx, card.rank, card.suit); ctx.restore();
    const rank = card.rank;
    if (rank === 'J' || rank === 'Q' || rank === 'K') {
      ctx.fillStyle = '#f1e7cc'; ctx.fillRect(49, 50, 152, 250);
      ctx.strokeStyle = '#b39554'; ctx.lineWidth = 2; ctx.strokeRect(49, 50, 152, 250);
      ctx.lineWidth = .7; ctx.strokeRect(53, 54, 144, 242);
      courtHalf(ctx, rank, card.suit);
      ctx.save(); ctx.translate(W, H); ctx.rotate(Math.PI); courtHalf(ctx, rank, card.suit); ctx.restore();
      ctx.strokeStyle = '#b39554'; ctx.beginPath(); ctx.moveTo(54, 175); ctx.lineTo(196, 175); ctx.stroke();
    } else {
      const layouts = {
        A: [[125, 175]],
        '2': [[125, 88], [125, 262]],
        '3': [[125, 82], [125, 175], [125, 268]],
        '4': [[76, 88], [174, 88], [76, 262], [174, 262]],
        '5': [[76, 88], [174, 88], [125, 175], [76, 262], [174, 262]],
        '6': [[76, 82], [174, 82], [76, 175], [174, 175], [76, 268], [174, 268]],
        '7': [[76, 82], [174, 82], [125, 128], [76, 175], [174, 175], [76, 268], [174, 268]],
        '8': [[76, 82], [174, 82], [125, 128], [76, 175], [174, 175], [125, 222], [76, 268], [174, 268]],
        '9': [[76, 74], [174, 74], [76, 141], [174, 141], [125, 175], [76, 209], [174, 209], [76, 276], [174, 276]],
        '10': [[76, 74], [174, 74], [125, 107], [76, 141], [174, 141], [76, 209], [174, 209], [125, 243], [76, 276], [174, 276]]
      };
      const layout = layouts[rank] || layouts.A;
      for (const [x, y] of layout) suit(ctx, card.suit, x, y, rank === 'A' ? 78 : 35, y > H / 2);
      if (rank === 'A') {
        ctx.fillStyle = '#a99363'; ctx.font = '8px Georgia, serif'; ctx.textAlign = 'center';
        ctx.fillText('MAISON  ·  BACCARAT', 125, 232);
        ctx.strokeStyle = '#c9b990'; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.moveTo(89, 247); ctx.lineTo(161, 247); ctx.stroke();
      }
    }
    textures.set(key, canvas);
    return canvas;
  }

  function backTexture() {
    if (textures.has('back')) return textures.get('back');
    const { canvas, ctx } = makeTexture();
    paper(ctx);
    roundRect(ctx, 11, 11, W - 22, H - 22, 7);
    const red = ctx.createLinearGradient(0, 0, W, H);
    red.addColorStop(0, '#6c2330'); red.addColorStop(.5, '#41131f'); red.addColorStop(1, '#290e19');
    ctx.fillStyle = red; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.lineWidth = .6; ctx.strokeStyle = 'rgba(219, 183, 139, .37)';
    for (let y = -8; y < H + 16; y += 15) {
      for (let x = -8 + ((y + 8) % 30 ? 8 : 0); x < W + 16; x += 16) {
        ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = 'rgba(236, 206, 165, .28)'; ctx.fillRect(x - .7, y - .7, 1.4, 1.4);
      }
    }
    ctx.restore();
    for (const inset of [16, 20, 27]) {
      roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, 4);
      ctx.strokeStyle = inset === 20 ? '#c8a776' : '#a47a54'; ctx.lineWidth = inset === 20 ? 1.4 : .6; ctx.stroke();
    }
    ctx.fillStyle = '#421724'; ctx.strokeStyle = '#c3a372'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.ellipse(125, 175, 44, 66, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(125, 175, 39, 59, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(125, 175);
    for (let k = 0; k < 12; k++) {
      ctx.save(); ctx.rotate(k * Math.PI / 6); ctx.strokeStyle = '#a8865a'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.bezierCurveTo(-11, -38, -6, -49, 0, -52);
      ctx.bezierCurveTo(6, -49, 11, -38, 0, -22); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#421724'; ctx.beginPath(); ctx.ellipse(0, 0, 21, 30, 0, 0, Math.PI * 2); ctx.fill();
    suit(ctx, 'S', 0, 0, 29, false, '#d4b788');
    ctx.restore();
    for (const y of [48, 302]) {
      ctx.strokeStyle = '#b59467'; ctx.lineWidth = .9;
      ctx.beginPath(); ctx.moveTo(79, y); ctx.quadraticCurveTo(102, y - 11, 125, y);
      ctx.quadraticCurveTo(148, y + 11, 171, y); ctx.stroke();
      suit(ctx, 'D', 125, y, 8, false, '#d4b788');
    }
    textures.set('back', canvas);
    return canvas;
  }

  function cornerInset(y) {
    const distance = Math.min(y, H - y);
    if (distance >= 13) return 1;
    return 14 - Math.sqrt(Math.max(0, 13 * 13 - (13 - Math.max(0, distance)) ** 2));
  }

  function paint(canvas, card, { faceUp = false, peel = 0 } = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    if (canvas.width !== W * SCALE) canvas.width = W * SCALE;
    if (canvas.height !== H * SCALE) canvas.height = H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (faceUp) { ctx.drawImage(faceTexture(card), 0, 0, W, H); return; }
    const back = backTexture();
    const progress = Math.max(0, Math.min(1, Number(peel) || 0));
    if (progress < .002) { ctx.drawImage(back, 0, 0, W, H); return; }

    // A cylinder rolls the paper from its bottom edge. Each material strip is
    // projected using sin(angle); the underside becomes visible past 90°.
    // After 180°, the face continues as the lifted, straight end of the card.
    const lifted = H * .58 * Math.min(1, progress / .72);
    const hinge = H - lifted;
    const radius = Math.min(25, Math.max(.5, lifted * .21));
    const arcLength = Math.PI * radius;
    const freeEdge = hinge - Math.max(0, lifted - arcLength);
    const front = faceTexture(card);
    ctx.drawImage(back, 0, 0, W * SCALE, hinge * SCALE, 0, 0, W, hinge);

    // The moving shadow falls across the back and the exposed table.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.53)'; ctx.shadowBlur = 15 + progress * 12;
    ctx.shadowOffsetY = 6 + progress * 7;
    ctx.fillStyle = 'rgba(0,0,0,.19)';
    roundRect(ctx, 7, freeEdge + 8, W - 14, Math.max(2, hinge + radius - freeEdge - 9), 10);
    ctx.fill(); ctx.restore();

    function project(u) {
      return u < arcLength ? hinge + radius * Math.sin(u / radius) : hinge - (u - arcLength);
    }

    // Texture rows stay attached to the paper instead of crossfading two cards.
    const step = .65;
    for (let u = 0; u < lifted; u += step) {
      const end = Math.min(lifted, u + step);
      const middle = (u + end) / 2;
      const angle = Math.min(Math.PI, middle / radius);
      const underside = angle > Math.PI / 2;
      const y1 = project(u);
      const y2 = project(end);
      const height = Math.max(.35, Math.abs(y2 - y1) + .38);
      const materialY = hinge + u;
      const inset = cornerInset(hinge + middle);
      const sourceWidth = W - inset * 2;
      const destinationY = Math.min(y1, y2);
      ctx.save();
      // A turned-up card reverses both axes of its underside. The lower-right
      // rank consequently reads upright at the moving free edge of the peel.
      if (underside) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      ctx.drawImage(underside ? front : back, inset * SCALE, materialY * SCALE,
        sourceWidth * SCALE, (end - u) * SCALE, inset, destinationY, sourceWidth, height);
      ctx.restore();
    }
    // Shade the continuous projected surface once, avoiding dark seams where
    // neighboring texture strips overlap close to the cylinder's silhouette.
    const curlShade = ctx.createLinearGradient(0, hinge, 0, hinge + radius);
    curlShade.addColorStop(0, 'rgba(255,243,216,.035)');
    curlShade.addColorStop(.3, 'rgba(28,18,9,.035)');
    curlShade.addColorStop(.75, 'rgba(28,18,9,.16)');
    curlShade.addColorStop(1, 'rgba(20,13,8,.45)');
    ctx.fillStyle = curlShade;
    ctx.fillRect(1, hinge, W - 2, radius);
    // Fine specular rim along the curved outer edge gives the paper thickness.
    const crest = hinge + radius;
    ctx.strokeStyle = 'rgba(255,246,223,.6)'; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(2, crest); ctx.quadraticCurveTo(W / 2, crest + .6, W - 2, crest); ctx.stroke();
  }

  root.BaccaratCards = Object.freeze({ paint });
})(typeof globalThis !== 'undefined' ? globalThis : window);
