let socket = io("//bonziworld.org");
let moving = false;
let error_id = "error_disconnect";
let target;
let room = "";
let level = 0;
let minx = 0;
//0 = normal, 1 = DM, 2 = reply
let talkstate = 0;
let talktarget = undefined;
let mobile = innerWidth <= 560;
let stage;
const agents = {};
let mouseevents = {
    mousemove: "mousemove",
    mousedown: "mousedown",
    mouseup: "mouseup"
}
if (mobile) mouseevents = {
    mousemove: "touchmove",
    mousedown: "touchstart",
    mouseup: "touchend"
}

window.tts = {};

const types = {
    "peedy": "peedy",
    "clippy": "clippy"
}

const colors = ["purple", "peedy", "clippy", "king", "pope"];

const sheets = {
    bonzi: {
        spritew: 200,
        spriteh: 160,
        w: 3400,
        h: 3360,
        toppad: 0,
        anims: {
            idle: 0,
            enter: [277, 302, "idle", 0.25],
            leave: [16, 39, 40, 0.25],
            grin_fwd: {
                frames: range(182, 189).concat([184]),
                next: "grin_back",
                speed: 0.25
            },
            grin_back: {
                frames: [183, 182],
                next: "idle",
                speed: 0.25
            },
            shrug_fwd: [40, 50, "shrug_idle", 0.25],
            shrug_idle: [50],
            shrug_back: {
                frames: range(40, 50).reverse(),
                speed: 0.25,
                next: "idle"
            },
            backflip: [331, 343, "idle", 0.25],
            swag_fwd: [108, 125, "swag_idle", 0.25],
            swag_idle: 125,
            swag_back: {
                frames: range(108, 125).reverse(),
                next: "idle",
                speed: 0.25
            },
            earth_fwd: [51, 56, "earth_idle", 0.25],
            earth_idle: [57, 80, "earth_idle", 0.25],
            earth_back: {
                frames: range(51, 58).reverse(),
                next: "idle",
                speed: 0.25
            },
            clap_fwd: {
                frames: [0, 10, 11, 12, 13, 14, 15, 13, 14, 15],
                next: "clap_back",
                speed: 0.25
            },
            clap_back: {
                frames: [13, 14, 15, 13, 14, 15, 12, 11, 10],
                next: "idle",
                speed: 0.25
            },
            beat_fwd: {
                frames: [0, 101, 102, 103, 104, 105, 106, 107, 104, 105, 106, 107],
                next: "beat_back",
                speed: 0.25
            },
            beat_back: {
                frames: [104, 105, 106, 107, 104, 105, 106, 107, 103, 102, 101],
                next: "idle",
                speed: 0.25
            },
            think_fwd: {
                frames: range(242, 247).concat([247, 247, 247, 247]),
                next: "think_back",
                speed: 0.25
            },
            think_back: {
                frames: range(242, 247).reverse(),
                next: "idle",
                speed: 0.25
            },
            bow_fwd: [224, 231, "bow_idle", 0.25],
            bow_idle: 232,
            bow_back: {
                frames: range(224, 232).reverse(),
                next: "idle",
                speed: 0.25
            },
            praise_fwd: [159, 163, "praise_idle", 0.25],
            praise_idle: 164,
            praise_back: {
                frames: range(159, 164).reverse(),
                next: "idle",
                speed: 0.25
            },
        },
    },
    //TODO: ADD PEEDY AND CLIPPY ANIMATIONS
    peedy: {
        spritew: 160,
        spriteh: 128,
        w: 4000,
        h: 4095,
        toppad: 12,
        anims: {
            idle: 0,
            enter: [659, 681, "idle", 0.25],
            leave: [23, 47, 47, 0.25]
        }
    },
    clippy: {
        spritew: 124,
        spriteh: 93,
        w: 3348,
        h: 3162,
        toppad: 40,
        anims: {
            idle: 0,
            enter: [410, 416, "idle", 0.25],
            leave: {
                frames: [0].concat(range(364, 411)),
                speed: 0.25
            }
        }
    },
}

const spritesheets = {};
colors.forEach(color => {
    if (types[color] != undefined) {
        let sheet = sheets[types[color]];
        spritesheets[color] = new createjs.SpriteSheet({
            images: ["./img/agents/" + color + ".png"],
            frames: {
                width: sheet.spritew,
                height: sheet.spriteh
            },
            animations: sheet.anims
        })

    } else {
        spritesheets[color] = new createjs.SpriteSheet({
            images: ["./img/agents/" + color + ".png"],
            frames: {
                width: 200,
                height: 160
            },
            animations: sheets.bonzi.anims
        })
    }
})

function $(id) {
    return document.getElementById(id);
}

//Primitive approach to linkifying a message
function linkify(msg) {
    //Don't linkify HTML messages
    if (msg.includes("<")) return msg;

    msg = msg.split(" ");
    let nmsg = [];
    msg.forEach(word => {
        if (word.startsWith("http://") || word.startsWith("https://")) {
            nmsg.push("<a href='" + word + "' target='_blank'>" + word + "</a>")
        } else nmsg.push(word);
    })
    return nmsg.join(" ");
}

class agent {
    constructor(x, y, upub) {
        let id = upub.guid;
        let image = upub.color;
        let sheet = sheets[image] == undefined ? sheets["bonzi"] : sheets[image];
        this.x = x;
        this.y = y;
        this.toppad = sheet.toppad;
        this.w = sheet.spritew;
        this.h = sheet.spriteh;
        this.anims = sheet.anims;
        this.id = upub.guid;
        this.lx = x;
        this.ly = y;
        this.pub = upub;

        if (image.startsWith("http") && settings.disableCCs) image = "purple";
        if (spritesheets[image] == undefined) {
            let img = new Image();
            img.crossOrigin = "anonymous";
            img.src = image;
            let spritesheet = new createjs.SpriteSheet({
                images: [img],
                frames: {
                    width: 200,
                    height: 160
                },
                animations: sheets.bonzi.anims
            })
            this.sprite = new createjs.Sprite(spritesheet, "enter");
        } else this.sprite = new createjs.Sprite(spritesheets[image], "enter");
        this.sprite.x = x;
        this.sprite.y = y + this.toppad;
        stage.addChild(this.sprite);

        let bubbleclass = (x > innerWidth / 2 - this.w / 2) ? "bubble-left" : "bubble-right";
        if (mobile) bubbleclass = (y > innerHeight / 2 - this.h / 2) ? "bubble-top" : "bubble-bottom";
        $("agent_content").insertAdjacentHTML("beforeend", `
    		<div id='` + id + `p' style='margin-top:` + y + `;margin-left:` + x + `;height: ` + (this.h + sheet.toppad) + `px;width: ` + this.w + `px;' class='agent_cont'>
            <span class='tag' id='` + id + `tg'></span>
            <span class='nametag' id='` + id + `n'><span id='` + id + `nn'>` + this.pub.dispname + `</span><span id='` + id + `nt'></span></span>
    		<span class='` + bubbleclass + `' style='display: none;' id='` + id + `b' >
    		<p id='` + id + `t' class='bubble_text'></p>
    		</span>
            <div style='width:${this.w};height:${this.h};' id='${this.id}c'></div>
    		</div>
    		`);
        this.parent = $(this.id + "p");
        $(id + "c").onclick = () => {
            if (this.lx == this.x && this.ly == this.y) this.cancel()
        };
        if (this.pub.tagged) {
            $(id + "tg").style.display = "inline-block";
            $(id + "tg").innerHTML = this.pub.tag;
        }

        //Move starter
        $(id + "c").addEventListener(mouseevents.mousedown, mouse => {
            movestart(mouse, this)
        });
    }
    update() {
        this.parent.style.marginLeft = this.x;
        this.parent.style.marginTop = this.y;
        this.sprite.x = this.x;
        this.sprite.y = this.y + this.toppad;
    }
    change(image) {
        this.cancel();
        let sheet = sheets[types[image]];
        let spritesheet;
        if spritesheet = spritesheets[image];
        if (sheet == undefined) sheet = sheets["bonzi"];
        this.w = sheet.spritew;
        this.h = sheet.spriteh;
        this.toppad = sheet.toppad;
        this.pub.color = image;

        //Re-size parent
        $(this.id + "p").style.width = this.w;
        $(this.id + "p").style.height = this.h + sheet.toppad;
        $(this.id + "c").style.width = this.w;
        $(this.id + "c").style.height = this.h;

        //Re-create styleobject
        stage.removeChild(this.sprite);
        this.anims = sheet.anims;
        this.sprite = new createjs.Sprite(spritesheet, "idle");
        this.update();
        stage.addChild(this.sprite);

        poscheck(this.id);
    }
    talk(write, say) {
        this.cancel();
        setTimeout(() => {
            $(this.id + "b").style.display = "block"
        }, 100);
        if (write.startsWith("-")) say = "";
        else say = desanitize(say);
        if (say != "") speak.play(say, this.id, this.pub.voice, () => {
            delete window.tts[this.id];
            $(this.id + "b").style.display = "none";
        })
        $(this.id + "t").innerHTML = linkify(write);
    }
    actqueue(list, i) {
        if (i == 0) this.cancel();
        if (i >= list.length) return;
        if (list[i].say == undefined) list[i].say = list[i].text;
        if (list[i].type == 0) {
            setTimeout(() => {
                $(this.id + "t").innerHTML = linkify(list[i].text);
                $(this.id + "b").style.display = "block"
                speak.play(list[i].say, this.id, this.pub.voice, () => {
                    delete window.tts[this.id];
                    $(this.id + "b").style.display = "none";
                    i++;
                    this.actqueue(list, i);
                })
            }, 100);
        } else {
            if (this.anims[list[i].anim] == undefined) {
                i++;
                this.actqueue(list, i);
                return;
            }
            let animlen = this.anims[list[i].anim].frames != undefined ? this.anims[list[i].anim].frames.length : this.anims[list[i].anim][1] - this.anims[list[i].anim][0]
            this.sprite.gotoAndPlay(list[i].anim)
            setTimeout(() => {
                i++;
                this.actqueue(list, i);
            }, 1000 / 15 * animlen)
        }
    }
    kill(playignore) {
        this.cancel();
        if (!playignore) {
            this.sprite.gotoAndPlay("leave");
            let animlen = 1000 / 15 * (this.anims.leave[1] - this.anims.leave[0]);
            setTimeout(() => {
                stage.removeChild(this.sprite);
                $(this.id + "p").remove();
            }, animlen)
        } else {
            stage.removeChild(this.sprite);
            $(this.id + "p").remove();
        }
        delete agents[this.id];
    }
    cancel() {
        $(this.id + "b").style.display = "none";
        if (window.tts[this.id] != undefined && window.tts[this.id].started) {
            window.tts[this.id].stop();
            window.tts[this.id] = undefined;
        } else if (window.tts[this.id] != undefined) {
            window.tts[this.id].start = () => {};
            window.tts[this.id] = undefined;
        }
        this.sprite.stop();
        this.sprite.gotoAndPlay("idle");
        //If left, remove (BUG FIX)
        if (agents[this.id] == undefined) {
            stage.removeChild(this.sprite);
            $(this.id + "p").remove();
        }
    }
                      }

function poscheck(agent) {
    agent = agents[agent];
    if (agent.x > innerWidth - agent.w) agent.x = innerWidth - agent.w;
    if (agent.y > innerHeight - 32 - agent.h) agent.y = innerHeight - 32 - agent.h;
    //Find new bubble location.
    if (agent.x > innerWidth / 2 - agent.w / 2 && !mobile) $(agent.id + "b").className = "bubble-left";
    else if (!mobile) $(agent.id + "b").className = "bubble-right";
    else if (agent.y > innerHeight / 2 - agent.h / 2) $(agent.id + "b").className = "bubble-top";
    else $(agent.id + "b").className = "bubble-bottom";
    agent.update();
}

function movestart(mouse, self) {
    if (moving) return;
    if (mouse.touches != undefined) mouse = mouse.touches[0];
    target = self;
    //Find offset of mouse to target
    target.offsetx = mouse.clientX - target.x;
    target.offsety = mouse.clientY - target.y;
    target.lx = target.x;
    target.ly = target.y;
    //Enable moving
    moving = window.cont == undefined;
}


function mousemove(mouse) {
    if (mouse.touches != undefined) mouse = mouse.touches[0];
    if (!moving) return;

    //Find new x. If new x above or below limits, set it to appropriate limit.
    target.x = Math.max(minx, Math.min(innerWidth - target.w, mouse.clientX - target.offsetx))

    //Do the same as above to Y
    target.y = Math.max(0, Math.min(innerHeight - target.h - 32, mouse.clientY - target.offsety));

    //Find new bubble location.
    if ($(target.id + "b") != undefined) {
        if (mobile) $(target.id + "b").className = target.y > innerHeight / 2 - target.h / 2 ? "bubble-top" : "bubble-bottom";
        else $(target.id + "b").className = target.x > innerWidth / 2 - target.w / 2 ? "bubble-left" : "bubble-right";
    }
    target.update();
}

function mouseup(mouse) {
    if (mouse.touches != undefined) mouse = mouse.touches[0];
    moving = false;
}

function movehandler() {
    //Moving
    document.addEventListener(mouseevents.mousemove, mousemove)
    document.addEventListener(mouseevents.mouseup, mouseup)

    //On resize
    window.addEventListener("resize", () => {
        $("bonzicanvas").width = innerWidth;
        $("bonzicanvas").height = innerHeight;
        stage.updateViewport(innerWidth, innerHeight);
        Object.keys(agents).forEach(poscheck)
    })

    //Context menu
    document.addEventListener("contextmenu", mouse => {
                mouse.preventDefault();
                moving = false;
                //Find agent the mouse is over
                let bid = -1;
                Object.keys(agents).forEach((akey) => {
                    //Check if within bounds of an agent. Pretty long condition.
                    if (
                        mouse.clientX > agents[akey].x &&
                        mouse.clientX < agents[akey].x + agents[akey].w &&
                        mouse.clientY > agents[akey].y &&
                        mouse.clientY < agents[akey].y + agents[akey].h + agents[akey].toppad
                    ) bid = akey;
                })

                //Contextmenu if found passing agent through
                if (bid > -1) {
                    //Define the contextmenu upon click (so it can be dynamic)
                    let cmenu = [{
                                type: 0,
                                name: "Cancel",
                                callback: (passthrough) => {
                                    passthrough.cancel();
                                }
                            },
                                 type: 0,
                    name: "Call an Asshole",
                    callback: (passthrough) => {
                        socket.emit("command", {
                            command: "asshole",
                            param: passthrough.pub.name
                        })
                    }
                }, {
                    type: 0,
                    name: "Notice Bulge",
                    callback: (passthrough) => {
                        socket.emit("command", {
                            command: "owo",
                            param: passthrough.pub.name
                        })
                    }
                }, {
                        type: 0,
                        name: "Kick",
                        disabled: level <= 1,
                        callback: (passthrough) => {
                            socket.emit("command", {
                                command: "kick",
                                param: passthrough.id
                            })
                        }
                    },
                 }
                    }, ]
                })
            }
            window.cont = contextmenu(cmenu, mouse.clientX, mouse.clientY, agents[bid], window.cont);
        }
    })
}

function talk() {
    let say = $("chatbar").value;
    } else if (say.startsWith("/")) {
        //Parse command
        let cmd = say.split(" ");
        let command = cmd[0].substring(1);
        cmd.splice(0, 1);
        let param = cmd.join(" ");
        if (clientcommands[command] == undefined) socket.emit("command", {
            command: command,
            param: param
        });
        else clientcommands[command](param);
        if (command == "kingmode" || command == "godmode") {
            settings.autorun = {
                command: command,
                param: param
            };
            document.cookie = compileCookie(settings);
        }
    } else if (say.startsWith("https://youtube.com/watch?v=") || say.startsWith("https://www.youtube.com/watch?v=") || say.startsWith("https://youtu.be/")) {
        socket.emit("command", {
            command: "youtube",
            param: say
        });
    } else {
        socket.emit("talk", say);
    }
    $("chatbar").value = "";
  }
                
  function setup(logindata) {
    if (window.ticker == undefined) window.ticker = setInterval(() => {
        stage.update();
    }, 17)
    error_id = "error_disconnect";
    $("error_page").style.display = "none";
    $("error_restart").style.display = "none";
    $("error_disconnect").style.display = "none";

    level = logindata.level;
    //Show main UI
    $("room_name").innerHTML = logindata.roomname;
    $("room_count").innerHTML = Object.keys(logindata.users).length;
    room = logindata.roomname;
    $("error_room").innerHTML = logindata.roomname;
    $("room_priv").innerHTML = logindata.roompriv ? "private" : "public";
    $("login").style.display = "none";
    $("content").style.display = "block";

    //Create agents
    Object.keys(logindata.users).forEach(userkey => {
        let user = logindata.users[userkey];
        let type = sheets[types[user.color]] == undefined ? sheets["bonzi"] : sheets[types[user.color]]
        let x = Math.floor(Math.random() * (innerWidth - type.spritew - minx)) + minx;
        let y = Math.floor(Math.random() * (innerHeight - type.spriteh - 32 - type.toppad));
        agents[userkey] = new agent(x, y, user)
    })

    $("chatbar").addEventListener("keydown", key => {
        if (key.which == 13) talk();
    });
    $("chatbar").addEventListener("keyup", () => {
            if ($("chatbar").value.startsWith("/")) socket.emit("typing", 2);
            else if ($("chatbar").value != "") socket.emit("typing", 1);
            else socket.emit("typing", 0)
        })

    //Socket event listeners
    socket.on("leave", guid => {
        agents[guid].kill();
        $("room_count").innerHTML = Object.keys(agents).length;
    })
    socket.on("join", user => {
        let sheet = sheets[types[user.color]] == undefined ? sheets["bonzi"] : sheets[types[user.color]]
        let x = Math.floor(Math.random() * (innerWidth - sheet.spritew - minx)) + minx;
        let y = Math.floor(Math.random() * (innerHeight - sheet.spriteh - 32 - sheet.toppad));
        agents[user.guid] = new agent(x, y, user);
        $("room_count").innerHTML = Object.keys(agents).length;
    })
    socket.on("update", user => {
        $(agents[user.guid].id + "nt").innerHTML = user.muted ? "<br>(MUTED)" : user.typing;
        agents[user.guid].typing = user.typing;
        //Prevent unneccessary name/tag/color updates (for special effects)
        if (user.dispname != agents[user.guid].pub.dispname) $(agents[user.guid].id + "nn").innerHTML = user.dispname;
        if (user.tag != agents[user.guid].pub.tag && user.tagged) {
            $(user.guid + "tg").innerHTML = user.tag;
            $(user.guid + "tg").style.display = "inline-block";
        }
        let oldcolor = agents[user.guid].pub.color;
        agents[user.guid].pub = user;

        if (user.color != oldcolor) agents[user.guid].change(user.color)
    })
    socket.on("talk", text => {
        agents[text.guid].talk(text.text, text.say == undefined ? text.text : text.say);
    })
    socket.on("actqueue", queue => {
        agents[queue.guid].actqueue(queue.list, 0);
    })
    socket.on("kick", kicker => {
        error_id = "error_kick";
        $("error_kicker").innerHTML = kicker;
    })
      }


function start() {
    socket.emit("login", {
        name: $("nickname").value,
        room: $("room").value,
        color: settings.color
    })
    settings.name = $("nickname").value.replace(/ /g, "") == "" ? "Anonymous" : $("nickname").value;
    document.cookie = compileCookie(settings);
    $("login_card").style.display = "none";
    $("loading").style.display = "block";
}

function tile() {
    let x = 0;
    let sx = 0;
    let y = 0;
    Object.keys(agents).forEach(agent => {
        agent = agents[agent];
        agent.x = x;
        agent.y = y;
        agent.update();
        x += agent.w;
        if (x > innerWidth - agent.w) {
            x = sx;
            y += agent.h;
        }
        if (y > innerHeight - agent.w - 32) {
            sx += 20;
            x = sx;
            y = 0;
        }
    })
}

//So the speaking isn't affected by sanitization
function desanitize(text) {
    return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&lbrack;/g, "square bracket");
}

window.onload = () => {
    $("bonzicanvas").width = innerWidth;
    $("bonzicanvas").height = innerHeight;
    stage = new createjs.StageGL($("bonzicanvas"), {
        transparent: true
    });
    settings.bg.replace(/["']/g, "") + "'></img>"
    $("content").addEventListener("mouseup", mouse => {
        if (mouse.touches != undefined) mouse = mouse.touches[0];
        if (window.cont != undefined && mouse.button != 2) window.cont = killmenus(window.cont);
    })
    movehandler();
    $("loading").style.display = "none";
    $("login_card").style.display = "block";
    socket.on("login", setup);
    socket.io.on("reconnect", () => {
        if ((error_id == "error_disconnect" || error_id == "error_restart") && room != "") {
            //Clear previous event listeners
            socket.off("leave");
            socket.off("join");
            socket.off("update");
            socket.off("kick");
            socket.off("talk");
            socket.off("actqueue");
            socket.off("update_self");
        }
    })
}

socket.on("error", error => {
    $("login_error").innerHTML = error;
    $("login_error").style.display = "block";
    $("login_card").style.display = "block";
    $("loading").style.display = "none";
})

socket.on("disconnect", () => {
    Object.keys(agents).forEach(agent => {
        agents[agent].kill(true);
    })
    $("error_page").style.display = "block";
    $(error_id).style.display = "block";
})

function parseCookie(cookie) {
    let settings = {};
    cookie = cookie.split("; ");
    cookie.forEach(item => {
        let key = item.substring(0, item.indexOf("="));
        let param = item.substring(item.indexOf("=") + 1, item.length);
        if (key == "settings") {
            try {
                settings = JSON.parse(atob(param.replace(/_/g, "/").replace(/-/g, "+")));
            } catch (exc) {
                console.log("COOKIE ERROR. RESETTING.");
                document.cookie = compileCookie({});
            }
        }
    })
    return settings;
}

function compileCookie(cookie) {
    let date = new Date();
    date.setDate(new Date().getDate() + 365);
    document.cookie = "settings=" + btoa(JSON.stringify(cookie)).replace(/\//g, "_").replace(/\+/g, "-") + "; expires=" + date;
}

function clearCookie() {
    let date = new Date();
    date.setDate(new Date().getDate() - 365);
    document.cookie.split("; ").forEach(item => {
        document.cookie = item + "; expires=" + date;
    })
}

function range(bottom, to) {
    let x = [];
    for (i = bottom; i <= to; i++) {
        x.push(i);
    }
    return x;
}
