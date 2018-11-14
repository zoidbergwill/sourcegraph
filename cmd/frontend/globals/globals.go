// Package globals contains global variables that should be set by the frontend's main function on initialization.
package globals

import (
	"net/url"
	"os"

	"github.com/sourcegraph/sourcegraph/pkg/conf"
	"github.com/sourcegraph/sourcegraph/pkg/conf/conftypes"
)

// ExternalURL is the fully-resolved, externally accessible frontend URL.
var ExternalURL = &url.URL{Scheme: "http", Host: "example.com"}

// ConfigurationServerFrontendOnly provides the contents of the site configuration
// to other services and manages modifications to it.
//
// Any another service that attempts to use this variable will panic.
var ConfigurationServerFrontendOnly = conf.InitConfigurationServerFrontendOnly(configurationSource{
	configFilePath: os.Getenv("SOURCEGRAPH_CONFIG_FILE"),
})

type configurationSource struct {
	configFilePath string
}

func (c configurationSource) Read() (conftypes.RawUnifiedConfiguration, error) {
	// TODO(slimsag): UnifiedConfiguration
	return conftypes.RawUnifiedConfiguration{}, nil
	/*
		data, err := ioutil.ReadFile(c.FilePath())
		if err != nil {
			return "", errors.Wrapf(err, "unable to read config file from %q", c.FilePath())
		}

		return string(data), err
	*/
}

func (c configurationSource) Write(input conftypes.RawUnifiedConfiguration) error {
	// TODO(slimsag): UnifiedConfiguration
	//return ioutil.WriteFile(c.FilePath(), []byte(input), 0600)
	return nil
}

func (c configurationSource) FilePath() string {
	filePath := c.configFilePath
	if filePath == "" {
		filePath = "/etc/sourcegraph/config.json"
	}

	return filePath
}
