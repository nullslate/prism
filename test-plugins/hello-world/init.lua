local prism = require("prism")

local function setup(opts)
    local greeting = opts.greeting or "Hello from plugin!"

    prism.command({
        id = "hello",
        label = "Say Hello",
        action = function()
            prism.toast(greeting)
        end,
    })

    prism.status({
        id = "hello-status",
        align = "right",
        update = function(event)
            return "HW"
        end,
    })

    prism.on("file:opened", function(event)
        prism.log("File opened: " .. (event.name or "unknown"))
    end)

    prism.log("hello-world plugin loaded!")
end

return { setup = setup }
