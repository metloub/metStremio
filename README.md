# metStremio

It’s a **local Stremio addon** that connects what you’re watching to **Discord Rich Presence**.

# What it does

When you select something in Stremio, it detects it locally and updates your Discord status.

So you get stuff like:

* 🎬 Watching *Inception (2010)*
* 📺 Series support (season / episode tracking)
* ⏱ Playback timer (still improving accuracy)

It’s simple on the surface, but honestly feels pretty nice when it’s running.

# How it works

* Stremio triggers local addon events (stream / meta)
* The addon tracks what you selected and what’s playing
* It keeps a local state (no servers involved)
* Discord Rich Presence gets updated from that state

# What works so far

* Movie + series detection
* Discord Rich Presence updates
* Basic playback timer system
* Stream selection detection
* Episode tracking (in progress)

# Still improving

It’s not “finished” yet. I’m still working on:

* better playback timing accuracy
* cleaner state transitions
* fixing occasional missing metadata (titles sometimes lag)
* handling weird Stremio edge cases

# Open source

I’ll clean it up and put it on GitHub once it’s in a better shape.

Plan is to keep it:
* simple to run locally
* easy to modify
* fully open source
* hackable for people who want to extend it

# 🤝 Feedback welcome

If you’ve worked with **Stremio addons** or **Discord RPC**, I’d honestly love feedback.

Discord Server: [discord.metloub.com](https://discord.metloub.com)
