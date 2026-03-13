local prism = require("prism")

prism.on("file:opened", function(payload)
  prism.log("Backlinks: file opened - " .. (payload.path or ""))
end)
