const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="url(#paint0_linear)"/>
  <circle cx="256" cy="256" r="210" fill="url(#paint1_radial)" opacity="0.25"/>
  
  <!-- Book / Flashcard Icon -->
  <g transform="translate(106, 106) scale(0.588)">
    <rect x="50" y="40" width="300" height="400" rx="36" fill="white" fill-opacity="0.95" filter="drop-shadow(0px 20px 30px rgba(0,0,0,0.3))"/>
    <rect x="70" y="70" width="260" height="340" rx="24" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="6"/>
    
    <!-- Letter B in gradient -->
    <text x="200" y="270" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="190" fill="url(#paint2_linear)">B</text>
    
    <!-- Decorative sparkles / dots -->
    <circle cx="200" cy="115" r="12" fill="#6366F1"/>
    <rect x="130" y="320" width="140" height="12" rx="6" fill="#0D9488"/>
    <rect x="150" y="345" width="100" height="10" rx="5" fill="#A855F7"/>
  </g>
  
  <defs>
    <linearGradient id="paint0_linear" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#312E81"/>
      <stop offset="0.5" stop-color="#4338CA"/>
      <stop offset="1" stop-color="#0F172A"/>
    </linearGradient>
    <radialGradient id="paint1_radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(256 120) rotate(90) scale(300)">
      <stop stop-color="#818CF8"/>
      <stop offset="1" stop-color="#818CF8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="paint2_linear" x1="100" y1="100" x2="300" y2="300" gradientUnits="userSpaceOnUse">
      <stop stop-color="#4F46E5"/>
      <stop offset="1" stop-color="#0D9488"/>
    </linearGradient>
  </defs>
</svg>
`;

// Save icon.svg
fs.writeFileSync(path.join(__dirname, 'public', 'icon.svg'), svgIcon);

async function generateIcons() {
  const publicDir = path.join(__dirname, 'public');
  const svgBuffer = Buffer.from(svgIcon);

  // 192x192
  await sharp(svgBuffer).resize(192, 192).toFile(path.join(publicDir, 'pwa-192.png'));
  console.log('Generated pwa-192.png');

  // 512x512
  await sharp(svgBuffer).resize(512, 512).toFile(path.join(publicDir, 'pwa-512.png'));
  console.log('Generated pwa-512.png');

  // 180x180 apple touch icon
  await sharp(svgBuffer).resize(180, 180).toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 32x32 favicon
  await sharp(svgBuffer).resize(32, 32).toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('Generated favicon-32x32.png');

  // 16x16 favicon
  await sharp(svgBuffer).resize(16, 16).toFile(path.join(publicDir, 'favicon-16x16.png'));
  console.log('Generated favicon-16x16.png');
}

generateIcons().catch(err => console.error('Icon generation failed:', err));
