local prism = require("prism")

prism.on("file:opened", function(payload)
  prism.log("Outline: file opened - " .. (payload.path or ""))
end)
