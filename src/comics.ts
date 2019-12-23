
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

async function photo2comics_resnet (image, size, ctx, new_model): Promise<string> {

  let out_path = new_model ? 'data://defileroff/photo2comics_resnet_128_400_60eps/'+uuidv4()+'.jpg' : 'data://defileroff/photo2comics_resnet_out/'+uuidv4()+'.jpg'
  let algo_path = new_model ? 'defileroff/photo2comics_rn9_128_400/0.1.0' : 'defileroff/photo2comics_resnet/0.1.3'
  let request = {"in":image, "out":out_path, "size": size}
  console.log('sent to algo')
  const response = await client
    .algo(algo_path)
    .pipe(request)
    
  saveAnalytics(ctx, response, request)

    if (!response.error){
      return new Promise((resolve, reject) =>
        client.file(out_path).get((err, result) => err ? reject(err) : resolve(result))
      )}
    else return '-1'
}

const MAX_TARGET = 1280
const MAX_SIZE = 700
const MIN_SIZE = 512

async function handleRequest(ctx){
  var img = ctx.update.message.photo[ctx.update.message.photo.length-1]
  var link = await ctx.telegram.getFileLink(img.file_id)

  //if it's a large photo, offer `large` option
  if (img.width >= MAX_SIZE || img.height >= MAX_SIZE){
    ctx.session.link = link;
    ctx.reply('Got your photo 👍 Save a small or a large one? ', imageMenu )
  }
  else {
    ctx.session.link = link;
    ctx.reply('Got your photo 👍 Which model will we use?', smallMenu )
  }
}

async function handleImage(link, size, ctx, new_model){

  const animeImage = await photo2comics_resnet(link, size, ctx, new_model)
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

const smallMenu = Telegraf.Extra
.markdown()
.markup((m) => m.inlineKeyboard([
  m.callbackButton('New', 'new_small'),
  m.callbackButton('Old', 'old_small')
]))

const imageMenu = Telegraf.Extra
.markdown()
.markup((m) => m.inlineKeyboard([
  m.callbackButton('New Large', 'new_large'),
  m.callbackButton('New Small', 'new_small'),
  m.callbackButton('Old Large', 'old_large'),
  m.callbackButton('Old Small', 'old_small')
], {columns: 2} ))

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


bot.action('new_small', async (ctx) => {
  let new_model = true
  ctx.answerCbQuery()
  ctx.editMessageText('New it is then! Doing my magic, may take a few minutes!')
  handleImage(ctx.session.link, MIN_SIZE, ctx, new_model)
})

bot.action('new_large', async (ctx) => {
  let new_model = true
  ctx.answerCbQuery()
  ctx.editMessageText('New large it is then! Doing my magic, may take a few minutes!')
  handleImage(ctx.session.link, MAX_TARGET, ctx, new_model)
})

bot.action('old_small', async (ctx) => {
  let new_model = false
  ctx.answerCbQuery()
  ctx.editMessageText('Old it is then! Doing my magic, may take a few minutes!')
  handleImage(ctx.session.link, MIN_SIZE, ctx, new_model)
})

bot.action('old_large', async (ctx) => {
  let new_model = false
  ctx.answerCbQuery()
  ctx.editMessageText('Old large it is then! Doing my magic, may take a few minutes!')
  handleImage(ctx.session.link, MAX_TARGET, ctx, new_model)
})

console.log('lauching')
bot.launch()

