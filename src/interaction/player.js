import Video from './player/video'
import Panel from './player/panel'
import Info from './player/info'
import Controller from './controller'
import Template from './template'
import Utils from '../utils/math'
import Playlist from './player/playlist'
import Storage from '../utils/storage'
import Platform from '../utils/platform'
import Screensaver from './screensaver'
import Reguest from '../utils/reguest'
import Android from '../utils/android'


let html = Template.get('player')
    html.append(Video.render())
    html.append(Panel.render())
    html.append(Info.render())

let callback
let work    = false
let network = new Reguest()

let preloader = {
    wait: false
}

html.on('mousemove',()=>{
    if(Storage.get('navigation_type') == 'mouse') Panel.mousemove()
})

/**
 * Подписываемся на события
 */
Video.listener.follow('timeupdate',(e)=>{
    Panel.update('time',Utils.secondsToTime(e.current | 0,true))
    Panel.update('timenow',Utils.secondsToTime(e.current || 0))
    Panel.update('timeend',Utils.secondsToTime(e.duration || 0))
    Panel.update('position', (e.current / e.duration * 100) + '%')

    if(work && work.timeline && e.duration){
        if(Storage.field('player_timecode') == 'continue' && !work.timeline.continued){
            let prend = e.duration - 15,
                posit = Math.round(e.duration * work.timeline.percent / 100)

            if(posit > 10) Video.to(posit > prend ? prend : posit)

            work.timeline.continued = true
        }
        else{
            work.timeline.percent = Math.round(e.current / e.duration * 100)
        }
    }
})

Video.listener.follow('progress',(e)=>{
    Panel.update('peding',e.down)
})

Video.listener.follow('canplay',(e)=>{
    Panel.canplay()
})

Video.listener.follow('play',(e)=>{
    Screensaver.disable()

    Panel.update('play')
})

Video.listener.follow('pause',(e)=>{
    Screensaver.enable()

    Panel.update('pause')
})

Video.listener.follow('rewind', (e)=>{
    Panel.rewind()
})

Video.listener.follow('ended', (e)=>{
    if(Storage.field('playlist_next')) Playlist.next()
})

Video.listener.follow('tracks', (e)=>{
    Panel.setTracks(e.tracks)
})

Video.listener.follow('subs', (e)=>{
    Panel.setSubs(e.subs)
})

Video.listener.follow('videosize', (e)=>{
    Info.set('size', e)
})

Video.listener.follow('error', (e)=>{
    Info.set('error', e.error)
})

Video.listener.follow('reset_continue', (e)=>{
    if(work && work.timeline) work.timeline.continued = false
})

Panel.listener.follow('mouse_rewind',(e)=>{
    let vid = Video.video()

    if(vid && vid.duration){
        e.time.removeClass('hide').text(Utils.secondsToTime(vid.duration * e.percent)).css('left',(e.percent * 100)+'%')

        if(e.method == 'click'){
            Video.to(vid.duration * e.percent)
        }
    }
})

Panel.listener.follow('playpause',(e)=>{
    Video.playpause()
})

Panel.listener.follow('playlist',(e)=>{
    Playlist.show()
})

Panel.listener.follow('size',(e)=>{
    Video.size(e.size)

    Storage.set('player_size',e.size)
})

Panel.listener.follow('prev',(e)=>{
    Playlist.prev()
})

Panel.listener.follow('next',(e)=>{
    Playlist.next()
})

Panel.listener.follow('rprev',(e)=>{
    Video.rewind(false)
})

Panel.listener.follow('rnext',(e)=>{
    Video.rewind(true)
})

Panel.listener.follow('subsview',(e)=>{
    Video.subsview(e.status)
})

Panel.listener.follow('visible',(e)=>{
    Info.toggle(e.status)
})

Panel.listener.follow('to_start',(e)=>{
    Video.to(0)
})

Panel.listener.follow('to_end',(e)=>{
    Video.to(-1)
})

Panel.listener.follow('quality',(e)=>{
    Video.destroy()

    Video.url(e.url)

    if(work && work.timeline) work.timeline.continued = false
})

Playlist.listener.follow('select',(e)=>{
    destroy()

    play(e.item)
})

Info.listener.follow('stat',(e)=>{
    if(preloader.wait){
        let pb = e.data.preloaded_bytes || 0,
            ps = e.data.preload_size || 0
        
        let progress = Math.min(100,((pb * 100) / ps ))

        Panel.update('timenow',Math.round(progress) + '%')
        Panel.update('timeend',100 + '%')

        Panel.update('peding',progress + '%')

        if(progress >= 90 || isNaN(progress)){
            Panel.update('peding','0%')

            preloader.wait = false
            preloader.call()
        }
    }
})

/**
 * Главный контроллер
 */
function toggle(){
    Controller.add('player',{
        invisible: true,
        toggle: ()=>{
            Panel.hide()
        },
        up: ()=>{
            Panel.toggle()
        },
        down: ()=>{
            Panel.toggle()
        },
        right: ()=>{
            Video.rewind(true)
        },
        left: ()=>{
            Video.rewind(false)
        },
        gone: ()=>{

        },
        enter: ()=>{
            Video.playpause()
        },
        playpause: () => {
            Video.playpause()
        },
        play: () => {
            Video.play()
        },
        pause: () => {
            Video.pause()
        },
        rewindForward: () => {
            Video.rewind(true)
        },
        rewindBack: () => {
            Video.rewind(false)
        },
        back: backward
    })

    Controller.toggle('player')
}


function backward(){
    destroy()

    if(callback) callback()
    else Controller.toggle('content')

    callback = false
}

/**
 * Уничтожить
 */
function destroy(){
    if(work.timeline) work.timeline.handler(work.timeline.percent)

    work = false

    preloader.wait = false
    preloader.call = null

    Screensaver.enable()

    Video.destroy()

    Panel.destroy()

    Info.destroy()

    html.detach()
}

function runWebOS(params){
    webOS.service.request("luna://com.webos.applicationManager", {
        method: "launch",
        parameters: { 
            "id": params.need, 
            "params": {
                "payload":[
                    {
                        "fullPath": params.url,
                        "artist":"",
                        "subtitle":"",
                        "dlnaInfo":{
                            "flagVal":4096,
                            "cleartextSize":"-1",
                            "contentLength":"-1",
                            "opVal":1,
                            "protocolInfo":"http-get:*:video/x-matroska:DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000",
                            "duration":0
                        },
                        "mediaType":"VIDEO",
                        "thumbnail":"",
                        "deviceType":"DMR",
                        "album":"",
                        "fileName": params.name,
                        "lastPlayPosition":-1
                    }
                ]
            }
        },
        onSuccess: function () {
            console.log("The app is launched");
        },
        onFailure: function (inError) {
            console.log('Player', "Failed to launch the app ("+params.need+"): ", "[" + inError.errorCode + "]: " + inError.errorText);

            if(params.need == 'com.webos.app.photovideo'){
                params.need = 'com.webos.app.smartshare'

                runWebOS(params)
            }
            else if(params.need == 'com.webos.app.smartshare'){
                params.need = 'com.webos.app.mediadiscovery'

                runWebOS(params)
            }
        }
    });
}



/**
 * Запустит плеер
 * @param {Object} data 
 */
function play(data){
    console.log('Player','url:',data.url)

    if(Platform.is('webos') && Storage.field('player') == 'webos'){
        runWebOS({
            need: 'com.webos.app.photovideo',
            url: data.url,
            name: data.path || data.title
        })
    } 
    else if(Platform.is('android') && Storage.field('player') == 'android'){
        Android.openPlayer(data.url, data)
    }
    else{
        work = data
        
        if(work.timeline) work.timeline.continued = false

        Playlist.url(data.url)

        Panel.quality(data.quality,data.url)

        Video.url(data.url)

        Video.size(Storage.get('player_size','default'))

        Info.set('name',data.title)
        
        if(!preloader.call) $('body').append(html)

        toggle()

        Panel.show(true)
    }
}

/**
 * Статистика
 * @param {String} url 
 */
function stat(url){
    if(work || preloader.wait) Info.set('stat',url)
}

/**
 * Установить плейлист
 * @param {Array} playlist 
 */
function playlist(playlist){
    if(work || preloader.wait) Playlist.set(playlist)
}

/**
 * Установить субтитры
 * @param {Array} subs 
 */
 function subtitles(subs){
    if(work || preloader.wait){
        Video.customSubs(subs)
    } 
}

/**
 * Обратный вызов
 * @param {Function} back 
 */
function onBack(back){
    callback = back
}

function render(){
    return html
}

export default {
    play,
    playlist,
    render,
    stat,
    subtitles,
    callback: onBack
}
