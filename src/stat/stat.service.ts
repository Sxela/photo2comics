var mongoose = require('mongoose')
import Stat from './stat.model';

mongoose.connect(process.env.MONGODB_URI, { useCreateIndex: true, useNewUrlParser: true });
mongoose.Promise = global.Promise;

export default async function create(statData){
    var update = statData.update;
    var request = statData.request;
    var response = statData.response;
    var new_stat = new Stat({
        update: update,
        request: request,
        response: response
    })
    await new_stat.save(function (error) {
        if (error) {
            console.log('stat save failed')

        }
        else console.log('stats saved')
    })

}

