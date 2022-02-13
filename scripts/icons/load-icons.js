const fs = require('fs-extra');
const axios = require('axios');
const Listr = require('listr');

const { FigmaApi } = require('../figma-api');

const {
  iconsFileKey,
  iconsPageId,
  iconsFolder,
  personalAccessToken,
  tempIconsFolder,
} = require('./icons.config');

const figmaApi = new FigmaApi({ personalAccessToken });

const tasks = new Listr([
  {
    title: 'Запрос информации о файле',
    task: async ctx => {
      const { components } = await figmaApi.getFile(iconsFileKey, {
        ids: [iconsPageId],
        depth: 2,
      });
      ctx.components = components;
    }
  },
  {
    title: 'Запрос изображений компонентов в формате svg',
    task: async ctx => {
      const { components } = ctx;
      const { images } = await figmaApi.getImage(iconsFileKey, {
        ids: Object.keys(components),
        format: 'svg',
      });
      ctx.images = images;
    }
  },
  {
    title: 'Загрузка svg исходников для каждого компонента',
    task: async ctx => {
      const { components, images } = ctx;
      const sources = await Promise.all(
        Object.keys(images).map(
          id => axios.get(images[id]).then(res => ({
            fileName: components[id].name,
            source: res.data,
          }))
        )
      );
      ctx.sources = sources;
    }
  },
  {
    title: 'Создание svg файлов во временной папке temp_icons',
    task: async ctx => {
      const { sources } = ctx;
      await Promise.all(
        sources.map(({ fileName, source }) =>
          fs.outputFile(`${tempIconsFolder}/${fileName}.svg`, source)
        )
      );
    }
  },
  {
    title: 'Перемещение временной папки в основную',
    task: async () => {
      await fs.move(tempIconsFolder, iconsFolder, { overwrite: true });
    }
  },
])

tasks.run().catch(error => {
  console.log(error);
  fs.remove(tempIconsFolder);
});