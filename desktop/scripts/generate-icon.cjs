/* Rasterize the existing vector; run with: node scripts/generate-icon.cjs. */
const path = require('node:path');
const fs = require('node:fs/promises');

if (!process.versions.electron) {
  const { spawn } = require('node:child_process');
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [__filename], {
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
  });
  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
  child.on('exit', (code) => process.exit(code ?? 1));
} else {
  const { app, BrowserWindow } = require('electron');
  app.setPath(
    'userData',
    path.resolve(__dirname, '../test-results/icon-generator'),
  );
  app.disableHardwareAcceleration();
  const dimensions = [16, 24, 32, 48, 64, 128, 256, 512];
  app
    .whenReady()
    .then(async () => {
      const source = await fs.readFile(
        path.resolve(__dirname, '../public/favicon.svg'),
        'utf8',
      );
      const window = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      try {
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        await window.loadURL(
          'data:text/html,<meta charset="utf-8"><title>JFLAP icon generator</title>',
        );
        const encoded = await window.webContents
          .executeJavaScript(`(async () => {
        const source = ${JSON.stringify(source)};
        const result = [];
        for (const size of ${JSON.stringify(dimensions)}) {
          const image = new Image(size, size);
          image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
          await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
          canvas.getContext('2d').drawImage(image, 0, 0, size, size);
          result.push({ size, png: canvas.toDataURL('image/png').split(',')[1] });
        }
        return result;
      })()`);
        const images = encoded.map(({ size, png }) => ({
          size,
          data: Buffer.from(png, 'base64'),
        }));
        const directory = path.resolve(__dirname, '../build');
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(
          path.join(directory, 'icon.png'),
          images.find((image) => image.size === 512).data,
        );
        const iconImages = images.filter((image) => image.size <= 256);
        const tableLength = 6 + iconImages.length * 16;
        const header = Buffer.alloc(tableLength);
        header.writeUInt16LE(1, 2);
        header.writeUInt16LE(iconImages.length, 4);
        let offset = tableLength;
        iconImages.forEach(({ size, data }, index) => {
          const entry = 6 + index * 16;
          header[entry] = size === 256 ? 0 : size;
          header[entry + 1] = size === 256 ? 0 : size;
          header.writeUInt16LE(1, entry + 4);
          header.writeUInt16LE(32, entry + 6);
          header.writeUInt32LE(data.length, entry + 8);
          header.writeUInt32LE(offset, entry + 12);
          offset += data.length;
        });
        await fs.writeFile(
          path.join(directory, 'icon.ico'),
          Buffer.concat([header, ...iconImages.map((image) => image.data)]),
        );
        console.log('Generated build/icon.png (512), build/icon.ico (16–256).');
        window.destroy();
        app.quit();
      } catch (error) {
        window.destroy();
        throw error;
      }
    })
    .catch((error) => {
      console.error(error);
      app.exit(1);
    });
}
