
var Telegraf = require('telegraf')
var uuidv4 = require('uuid/v4')
import create from './stat/stat.service';
import * as ratelimit from 'telegraf-ratelimit';
var Algorithmia = require('algorithmia');
var client = Algorithmia.client(process.env.ALGO_KEY)
var session = require('telegraf/session')

console.log('Loaded Algorithmia client')

import { ContextMessageUpdate } from 'telegraf'

export async function checkTime(ctx: ContextMessageUpdate, next: () => any) {
  if (ctx.updateType === 'message') {
    if (new Date().getTime() / 1000 - ctx.message.date < 5 * 60) {
      next()
    } else {
      console.log(
        `Ignoring message from ${ctx.from.id} at ${
          ctx.chat.id
        } (${new Date().getTime() / 1000}:${ctx.message.date})`
      )
    }
  } else {
    next()
  }
}

async function saveAnalytics(ctx, response, request){

  let statData = {
    update: ctx.update,
    response: response,
    request: request
  }
  console.log('saving stats')
  await create(statData)

}

async function photo2comics (image, size, light, ctx): Promise<string> {

  let out = 'data://defileroff/photo2comics_out/'+uuidv4()+'.jpg'
  let request = {"in":image, "out":out, "size": size, "light":light}
  console.log('sent to algo')
  const response = await client
    .algo('defileroff/photo2comics/0.1.2')
    .pipe(request)
    
  saveAnalytics(ctx, response, request)

    if (!response.error){
      return new Promise((resolve, reject) =>
        client.file(out).get((err, result) => err ? reject(err) : resolve(result))
      )}
    else return '-1'
}

const MAX_SIZE = 700
const MIN_SIZE = 512

async function handleRequest(ctx){
  var img = ctx.update.message.photo[ctx.update.message.photo.length-1]
  var link = await ctx.telegram.getFileLink(img.file_id)
  
  if (img.width >= MAX_SIZE || img.height >= MAX_SIZE){
    ctx.session.link = link;
    ctx.reply('Got your photo 👍 Save a small or a large one? ', imageMenu )
  }
  else {
    ctx.session.link = link;
    ctx.reply('Got your photo 👍 Which model will we use?', smallMenu )
    // ctx.reply('Got your photo 👍 Doing my magic, please wait!')
    // handleImage(link, MIN_SIZE, light, ctx)
  }
}

async function handleImage(link, size, light, ctx){
  const animeImage = await photo2comics(link, size, light, ctx)
  try {
    if (animeImage == '-1') {ctx.reply('Something went wrong!')} 
    else {
      await ctx.replyWithChatAction('upload_photo')
      await ctx.replyWithPhoto({ source: animeImage, filename: "comics.jpg" })
    }
  }
  catch(error){
    console.log(error)
  }
}

const limitConfig = {
  window: 1000 * 60 * 60,
  limit: 120,  
  keyGenerator: function (ctx) {
    return ctx.chat.id
  },
  onLimitExceeded: (ctx, next) => ctx.reply('😭 Rate limit exceeded: 120 photos per 60 minutes')
}

const imageMenu = Telegraf.Extra
.markdown()
.markup((m) => m.inlineKeyboard([
  m.callbackButton('Small light', 'small_l'),
  m.callbackButton('Large light', 'large_l'),
  m.callbackButton('Small artistic', 'small_a'),
  m.callbackButton('Large artistic', 'large_a'),
]))

const smallMenu = Telegraf.Extra
.markdown()
.markup((m) => m.inlineKeyboard([
  m.callbackButton('Light', 'small_l'),
  m.callbackButton('Artistic', 'small_a')
]))

const bot = new Telegraf(process.env.BOT_TOKEN)
bot.use(checkTime)
bot.use(ratelimit(limitConfig))
bot.use(session())


console.log('bot created')
bot.start((ctx) => ctx.reply('Welcome to photo2comics bot! Want to know how your photo would`ve looked in a comic book? You can check it right here. Drop me a photo (not a document) and I will do my magic! Photos bigger than 700 pixels by any side also get a large version!' ))
bot.help((ctx) => ctx.reply('Welcome to photo2comics bot! Want to know how your photo would`ve looked in a comic book? You can check it right here. Drop me a photo (not a document) and I will do my magic! Photos bigger than 700 pixels by any side also get a large version!'))
bot.on('photo', async (ctx) => {
  handleRequest(ctx)
})

bot.action('small_l', async (ctx) => {
  let light = true
  ctx.answerCbQuery()
  ctx.editMessageText('Small it is then! Doing my magic, may take a few minutes!')
  handleImage(ctx.session.link, MIN_SIZE, light, ctx)
})

bot.action('large_l', async (ctx) => {
  let light = true
  ctx.answerCbQuery()
  ctx.editMessageText('Large it is then! Doing my magic, may take a few minutes!')
  handleImage(ctx.session.link, MAX_SIZE, light, ctx)
})

bot.action('small_a', async (ctx) => {
  let light = false
  ctx.answerCbQuery()
  ctx.editMessageText('Small it is then! Doing my magic, may take a few minutes!')
  handleImage(ctx.session.link, MIN_SIZE, light, ctx)
})

bot.action('large_a', async (ctx) => {
  let light = false
  ctx.answerCbQuery()
  ctx.editMessageText('Large it is then! Doing my magic, may take a few minutes!')
  handleImage(ctx.session.link, MAX_SIZE, light, ctx)
})

console.log('lauching')
bot.launch()

