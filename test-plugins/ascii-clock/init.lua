local prism = require("prism")

local function setup(opts)
    prism.command({
        id = "toggle-clock",
        label = "Toggle ASCII Clock",
        shortcut = opts.shortcut or "ctrl+shift+c",
        action = function()
            prism.emit("ascii-clock:toggle")
        end,
    })

    prism.log("ascii-clock plugin loaded!")
end

return { setup = setup }
