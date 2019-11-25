var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var StatSchema = new Schema({
    update: Object,
    response: Object,
    request: Object
});

const Stat = mongoose.model("Stat", StatSchema);
export default Stat