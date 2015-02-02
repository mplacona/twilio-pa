exports.showMessage = function(agenda) {
	agenda.define('show message', function(job, done) {
        console.log("Shows message.");
		done();
    });
}